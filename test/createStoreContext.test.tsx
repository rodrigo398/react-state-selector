/* eslint react-hooks/exhaustive-deps: 0 */

import React, { FC, useEffect, useLayoutEffect } from "react";
import waitForExpect from "wait-for-expect";

import { act, cleanup, render } from "@testing-library/react";
import { act as actHooks, renderHook } from "@testing-library/react-hooks";

import { createSelector, createStoreContext } from "../src";
import { nRenderString, useRenderCount } from "./utils/useRenderCount";

afterEach(cleanup);

describe("basic createStore", () => {
  const initialStore = Object.freeze({
    a: 5,
    b: -5,
  });

  it("useStore works", () => {
    const { useStore, Provider } = createStoreContext(initialStore);

    const UseStoreComponent: FC = () => {
      const store = useStore();
      return <span>{store.a}</span>;
    };

    const { getByText, unmount } = render(<UseStoreComponent />, {
      wrapper: Provider,
    });

    const comp = getByText(initialStore.a.toString());

    expect(comp).toBeTruthy();
    unmount();
  });

  it("produce works with useStore", () => {
    const { useStore, useProduce, Provider } = createStoreContext(initialStore);

    const n = 5;

    const ProduceComponent: FC = () => {
      const store = useStore();
      const { produce } = useProduce();

      useLayoutEffect(() => {
        act(() => {
          produce(draft => {
            draft.a += n;
          });
        });
      }, []);

      return <span>{store.a}</span>;
    };

    const { container, unmount } = render(<ProduceComponent />, {
      wrapper: Provider,
    });

    expect(container.innerHTML).toContain(initialStore.a + n);

    unmount();
  });

  it("asyncProduce works with useStore", async () => {
    const { useStore, useProduce } = createStoreContext(initialStore);

    const n = 5;

    const AsyncProduceComponent: FC = () => {
      const store = useStore();
      const { asyncProduce } = useProduce();

      return (
        <>
          <button
            data-testid="button"
            onClick={async () => {
              await act(async () => {
                await asyncProduce(async draft => {
                  draft.a += await new Promise<number>(resolve => {
                    setTimeout(() => {
                      resolve(n);
                    }, 500);
                  });
                });
              });
            }}
          >
            click me
          </button>
          <span>{store.a}</span>
        </>
      );
    };

    const { container, unmount, getByTestId } = render(
      <AsyncProduceComponent />
    );

    expect(container.innerHTML).toContain(initialStore.a);

    getByTestId("button").click();
    await waitForExpect(
      async () => {
        expect(container.innerHTML).toContain((initialStore.a + n).toString());
      },
      2000,
      250
    );
    unmount();
  });

  it("asyncProduce works as getter", () => {
    const { useProduce, useStore } = createStoreContext({ a: 1 });

    const { result, unmount } = renderHook(() => {
      const store = useStore();
      const produceObj = useProduce();

      return { ...produceObj, store };
    });
    expect(result.current.produce()).toEqual({ a: 1 });
    expect(result.current.store).toEqual({ a: 1 });

    expect(result.current.asyncProduce()).resolves.toEqual({
      a: 1,
    });
    expect(result.current.store).toEqual({ a: 1 });

    expect(result.current.asyncProduce(async () => {})).resolves.toEqual({
      a: 1,
    });
    expect(result.current.store).toEqual({ a: 1 });

    unmount();
  });
});

describe("actions", () => {
  it("defined actions work", () => {
    const initialStore = Object.freeze({
      a: 1,
    });
    const { useActions, useStore, Provider } = createStoreContext(
      initialStore,
      {
        actions: {
          increment: (n: number) => draft => {
            draft.a += n;
          },
          decrement: (n: number) => draft => {
            draft.a -= n;
          },
        },
      }
    );

    const n = 5;

    const ActionsComp: FC = () => {
      const { a } = useStore();
      const Actions1 = useActions();
      // Check if the memoization of the actions is working
      const Actions2 = useActions();
      expect(Actions1).toBe(Actions2);

      return (
        <div>
          <button
            data-testid="increment"
            onClick={() => Actions1.increment(n)}
          />
          <button
            data-testid="decrement"
            onClick={() => Actions2.decrement(n)}
          />
          <span>{a}</span>
        </div>
      );
    };

    const { container, getByTestId, unmount } = render(<ActionsComp />, {
      wrapper: Provider,
    });

    const IncrementButton = getByTestId("increment");
    const DecrementButton = getByTestId("decrement");

    expect(container.innerHTML).toContain(initialStore.a);

    act(() => {
      IncrementButton.click();
    });

    expect(container.innerHTML).toContain(initialStore.a + n);

    act(() => {
      DecrementButton.click();
      DecrementButton.click();
    });

    expect(container.innerHTML).toContain(initialStore.a + n - n * 2);

    unmount();
  });
  it("empty actions options means useActions gives empty object", () => {
    const initialStore = Object.freeze({
      a: 1,
    });
    const { useActions } = createStoreContext(initialStore);

    const Comp: FC = () => {
      const actions = useActions();

      return <span>{JSON.stringify(actions)}</span>;
    };

    const { unmount, container } = render(<Comp />);

    expect(container.innerHTML).toContain("{}");
    unmount();
  });

  enum AsyncState {
    waiting,
    loading,
    error,
    complete,
  }

  it("async actions work", async () => {
    const initialStore = Object.freeze({
      a: 1,
      state: AsyncState.waiting,
    });

    const Store = createStoreContext(initialStore, {
      hooks: {},
      asyncActions: {
        asyncIncrement: produce => async (n: number) => {
          produce(draft => {
            draft.state = AsyncState.loading;
          });
          await new Promise(resolve => setTimeout(resolve, 500));

          produce(draft => {
            draft.state = AsyncState.complete;
            draft.a += n;
          });
        },
      },
      actions: {
        increment: (n: number) => draft => {
          draft.a += n;
        },
      },
    });

    const { unmount, result } = renderHook(
      () => {
        const store = Store.useStore();
        const actions = Store.useActions();

        return { store, actions };
      },
      {
        wrapper: Store.Provider,
      }
    );

    expect(result.current.store).toEqual({
      a: 1,
      state: AsyncState.waiting,
    });

    actHooks(() => {
      result.current.actions.increment(20);
    });

    expect(result.current.store).toEqual({ a: 21, state: AsyncState.waiting });

    const promiseIncrement = actHooks(async () => {
      await result.current.actions.asyncIncrement(10);
    });
    expect(result.current.store).toEqual({
      a: 21,
      state: AsyncState.loading,
    });

    await promiseIncrement;

    expect(result.current.store).toEqual({ a: 31, state: AsyncState.complete });

    unmount();
  });

  it("async actions handle errors", async () => {
    const initialStore = Object.freeze({
      a: 1,
      state: AsyncState.waiting,
    });

    const SampleError = new Error("test error");

    const Store = createStoreContext(initialStore, {
      hooks: {},
      asyncActions: {
        asyncError: produce => async (_n: number) => {
          await actHooks(async () => {
            produce(draft => {
              draft.state = AsyncState.loading;
            });
            await new Promise((_resolve, reject) =>
              setTimeout(() => {
                produce(draft => {
                  draft.state = AsyncState.error;
                });
                reject(SampleError);
              }, 500)
            );
          });
        },
      },
    });

    const { unmount, result } = renderHook(
      () => {
        const store = Store.useStore();
        const actions = Store.useActions();

        return { store, actions };
      },
      {
        wrapper: Store.Provider,
      }
    );

    expect(result.current.store).toEqual({
      a: 1,
      state: AsyncState.waiting,
    });

    const promiseIncrement = expect(
      result.current.actions.asyncError(10)
    ).rejects.toBe(SampleError);

    expect(result.current.store).toEqual({
      a: 1,
      state: AsyncState.loading,
    });

    await promiseIncrement;

    expect(result.current.store).toEqual({
      a: 1,
      state: AsyncState.error,
    });

    unmount();
  });

  it("should detect the same name on actions and asyncActions", () => {
    expect(() => {
      createStoreContext(
        {},
        {
          actions: {
            sameName: () => () => {},
          },
          asyncActions: {
            sameName: () => async () => {},
          },
        }
      );
    }).toThrowError(
      'All the actions and asyncActions should have different names and "sameName" exists in both objects!'
    );
  });

  it("should ignore the same name on actions and asyncActions in production", () => {
    expect(() => {
      const beforeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      createStoreContext(
        {},
        {
          actions: {
            sameName: () => () => {},
          },
          asyncActions: {
            sameName: () => async () => {},
          },
        }
      );
      process.env.NODE_ENV = beforeEnv;
    }).not.toThrow();
  });
});

describe("selectors and listeners", () => {
  it("basic number object and individual selectors", () => {
    const initialStore = Object.freeze({
      a: 1,
      b: 2,
      c: 3,
    });

    const {
      hooks: { useA, useB, useC },
    } = createStoreContext(initialStore, {
      hooks: {
        useA: store => store.a,
        useB: store => store.b,
        useC: store => store.c,
      },
    });

    const AComp: FC = () => {
      const n = useA();

      return <span>{n}</span>;
    };
    const BComp: FC = () => {
      const n = useB();

      return <span>{n}</span>;
    };
    const CComp: FC = () => {
      const n = useC();

      return <span>{n}</span>;
    };

    const aComp = render(<AComp />);
    const bComp = render(<BComp />);
    const cComp = render(<CComp />);

    expect(aComp.container.textContent).toBe(initialStore.a.toString());
    expect(bComp.container.textContent).toBe(initialStore.b.toString());
    expect(cComp.container.textContent).toBe(initialStore.c.toString());

    aComp.unmount();
    bComp.unmount();
    cComp.unmount();
  });

  it("selectors only re-renders component when needed", () => {
    const initialStore = Object.freeze({
      a: 5,
      b: 10,
    });

    const {
      useStore,
      hooks: { useA, useB, useAxB },
      useProduce,
      Provider,
    } = createStoreContext(initialStore, {
      hooks: {
        useA: store => {
          return store.a;
        },
        useB: store => {
          return store.b;
        },
        useAxB: store => store.a * store.b,
      },
    });

    const AllStoreComp: FC = () => {
      const store = useStore();
      const renderCount = useRenderCount();

      return (
        <div data-testid="allStore">
          <span>{renderCount}</span>
          <span>{JSON.stringify(store)}</span>
        </div>
      );
    };

    const OnlyAComp: FC = () => {
      const a = useA();
      const renderCount = useRenderCount();

      return (
        <div data-testid="onlyA">
          <span>{renderCount}</span>
          <span>A={a}</span>
        </div>
      );
    };

    const OnlyBComp: FC = () => {
      const b = useB();
      const renderCount = useRenderCount();

      return (
        <div data-testid="onlyB">
          <span>{renderCount}</span>
          <span>B={b}</span>
        </div>
      );
    };

    const OnlyAxBComp: FC = () => {
      const AxB = useAxB();
      const renderCount = useRenderCount();

      return (
        <div data-testid="onlyAxB">
          <span>{renderCount}</span>
          <span>AxB={AxB}</span>
        </div>
      );
    };

    const plusA = 5;

    const ProducerComp: FC = () => {
      const { produce } = useProduce();

      return (
        <button
          data-testid="producer"
          onClick={() => {
            act(() => {
              produce(draft => {
                draft.a += plusA;
              });
            });
          }}
        >
          Click here
        </button>
      );
    };

    const { getByTestId, unmount } = render(
      <Provider>
        <AllStoreComp />
        <OnlyAComp />
        <OnlyBComp />
        <OnlyAxBComp />
        <ProducerComp />
      </Provider>
    );

    const allStoreComp = getByTestId("allStore");
    const aComp = getByTestId("onlyA");
    const bComp = getByTestId("onlyB");
    const axbComp = getByTestId("onlyAxB");
    const producerComp = getByTestId("producer");

    expect(allStoreComp.innerHTML).toContain(nRenderString(1));
    expect(allStoreComp.innerHTML).toContain(JSON.stringify(initialStore));

    expect(aComp.innerHTML).toContain(nRenderString(1));
    expect(aComp.innerHTML).toContain(`A=${initialStore.a}`);

    expect(bComp.innerHTML).toContain(nRenderString(1));
    expect(bComp.innerHTML).toContain(`B=${initialStore.b}`);

    expect(axbComp.innerHTML).toContain(nRenderString(1));
    expect(axbComp.innerHTML).toContain(
      `AxB=${initialStore.a * initialStore.b}`
    );

    act(() => {
      producerComp.click();
    });

    expect(allStoreComp.innerHTML).toContain(nRenderString(2));
    expect(allStoreComp.innerHTML).toContain(
      JSON.stringify({ ...initialStore, a: initialStore.a + plusA })
    );

    expect(aComp.innerHTML).toContain(nRenderString(2));
    expect(aComp.innerHTML).toContain(`A=${initialStore.a + plusA}`);

    expect(bComp.innerHTML).toContain(nRenderString(1));
    expect(bComp.innerHTML).toContain(`B=${initialStore.b}`);

    expect(axbComp.innerHTML).toContain(nRenderString(2));
    expect(axbComp.innerHTML).toContain(
      `AxB=${(initialStore.a + plusA) * initialStore.b}`
    );

    unmount();
  });

  it("createSelector support and it makes a difference", () => {
    const initialStore = Object.freeze({
      list: Object.freeze([1, 3, 5, 7]),
      otherList: Object.freeze([0, 2, 4, 6]),
    });

    const {
      hooks: { useMultiplySlow, useMultiplyFast },
      useProduce,
      Provider,
    } = createStoreContext(initialStore, {
      hooks: {
        useMultiplySlow: store => {
          return store.list.map(n => n * 2);
        },
        useMultiplyFast: createSelector(
          state => state.list,
          list => {
            return list.map(n => n * 2);
          }
        ),
      },
    });

    const CompSlow: FC = () => {
      const list = useMultiplySlow();
      const renderCount = useRenderCount();

      return (
        <div data-testid="compSlow">
          <span>{renderCount}</span>
          <br />
          <span>{list.join("|")}</span>
        </div>
      );
    };

    const CompFast: FC = () => {
      const list = useMultiplyFast();
      const renderCount = useRenderCount();

      return (
        <div data-testid="compFast">
          <span>{renderCount}</span>
          <br />
          <span>{list.join("|")}</span>
        </div>
      );
    };

    const ProducerComp: FC = () => {
      const { produce } = useProduce();

      return (
        <button
          data-testid="producer"
          onClick={() => {
            act(() => {
              produce(draft => {
                draft.otherList.push(9);
              });
            });
          }}
        >
          Click here!
        </button>
      );
    };

    const initialListJoin = initialStore.list.map(n => n * 2).join("|");

    const { unmount, getByTestId } = render(
      <Provider>
        <CompSlow />
        <CompFast />
        <ProducerComp />
      </Provider>
    );
    const compSlow = getByTestId("compSlow");

    const compFast = getByTestId("compFast");

    const producerComp = getByTestId("producer");

    expect(compSlow.innerHTML).toContain(nRenderString(1));
    expect(compFast.innerHTML).toContain(nRenderString(1));
    expect(compSlow.innerHTML).toContain(initialListJoin);
    expect(compFast.innerHTML).toContain(initialListJoin);

    act(() => {
      producerComp.click();
    });

    expect(compSlow.innerHTML).toContain(nRenderString(2));
    expect(compFast.innerHTML).toContain(nRenderString(1));
    expect(compSlow.innerHTML).toContain(initialListJoin);
    expect(compFast.innerHTML).toContain(initialListJoin);

    unmount();
  });

  it("createSelector with props support and it makes a difference", () => {
    const initialStore = Object.freeze({
      list: Object.freeze([1, 3, 5, 7]),
      otherList: Object.freeze([0, 2, 4, 6]),
    });

    const {
      hooks: { useMultiplySlow, useMultiplyFast },
      useProduce,
      Provider,
    } = createStoreContext(initialStore, {
      hooks: {
        useMultiplySlow: (store, i: number) => {
          return store.list.map(n => n * i);
        },
        useMultiplyFast: createSelector<
          { list: readonly number[] },
          number,
          readonly number[],
          number,
          number[]
        >(
          state => state.list,
          (_, n) => n,
          (list, n) => {
            return list.map(i => i * n);
          }
        ),
      },
      actions: {},
    });

    const nArg = 4;

    const CompSlow: FC = () => {
      const list = useMultiplySlow(nArg);
      const renderCount = useRenderCount();

      return (
        <div data-testid="compSlow">
          <span>{renderCount}</span>
          <br />
          <span>{list.join("|")}</span>
        </div>
      );
    };

    const CompFast: FC = () => {
      const list = useMultiplyFast(nArg);
      const renderCount = useRenderCount();

      return (
        <div data-testid="compFast">
          <span>{renderCount}</span>
          <br />
          <span>{list.join("|")}</span>
        </div>
      );
    };

    const ProducerComp: FC = () => {
      const { produce } = useProduce();

      return (
        <button
          data-testid="producer"
          onClick={() => {
            act(() => {
              produce(draft => {
                draft.otherList.push(9);
              });
            });
          }}
        >
          Click here!
        </button>
      );
    };

    const initialListJoin = initialStore.list.map(n => n * nArg).join("|");

    const { unmount, getByTestId } = render(
      <Provider>
        <CompSlow />
        <CompFast />
        <ProducerComp />
      </Provider>
    );

    const compSlow = getByTestId("compSlow");

    const compFast = getByTestId("compFast");

    const producerComp = getByTestId("producer");

    expect(compSlow.innerHTML).toContain(nRenderString(1));
    expect(compFast.innerHTML).toContain(nRenderString(1));
    expect(compSlow.innerHTML).toContain(initialListJoin);
    expect(compFast.innerHTML).toContain(initialListJoin);

    act(() => {
      producerComp.click();
    });

    expect(compSlow.innerHTML).toContain(nRenderString(2));
    expect(compFast.innerHTML).toContain(nRenderString(1));
    expect(compSlow.innerHTML).toContain(initialListJoin);
    expect(compFast.innerHTML).toContain(initialListJoin);

    unmount();
  });
});

describe("context providers", () => {
  it("different providers have different state", () => {
    const initialStore = Object.freeze({
      a: 1,
      b: 2,
    });

    const { Provider, useStore, useProduce } = createStoreContext(initialStore);

    const StoreWatch: FC = () => {
      const store = useStore();

      return <span>{JSON.stringify(store)}</span>;
    };

    const Producer: FC<{ id?: string }> = ({ id }) => {
      const { produce } = useProduce();

      return (
        <button
          data-testid={id}
          onClick={() => {
            act(() => {
              produce(draft => {
                draft.a *= 2;
                draft.b *= 2;
              });
            });
          }}
        >
          click me!
        </button>
      );
    };

    const ContextA = render(
      <Provider>
        <StoreWatch />
        <Producer id="button" />
      </Provider>
    );
    const ContextB = render(
      <Provider>
        <StoreWatch />
        <Producer />
      </Provider>
    );

    expect(ContextA.container.innerHTML).toContain(
      JSON.stringify(initialStore)
    );
    expect(ContextB.container.innerHTML).toContain(
      JSON.stringify(initialStore)
    );

    ContextA.getByTestId("button").click();

    expect(ContextA.container.innerHTML).toContain(
      JSON.stringify({ a: initialStore.a * 2, b: initialStore.b * 2 })
    );
    expect(ContextB.container.innerHTML).toContain(
      JSON.stringify(initialStore)
    );

    ContextA.unmount();
    ContextB.unmount();
  });

  it("produce gives new instance of store", () => {
    const initialStore = Object.freeze({
      a: 1,
      b: 2,
    });
    const newStore = Object.freeze({
      a: 4,
      b: 5,
    });
    const Store = createStoreContext(initialStore, {
      actions: {
        newStore: () => () => {
          return newStore;
        },
      },
      hooks: {},
    });
    const { unmount, result, rerender } = renderHook(
      (n?: typeof newStore) => {
        const store = Store.useStore();
        const { produce } = Store.useProduce();
        useEffect(() => {
          if (n) {
            act(() => {
              produce(() => newStore);
            });
          }
        }, [n, produce]);
        return { store, produceGetterResult: produce() };
      },
      {
        wrapper: Store.Provider,
      }
    );

    expect(result.current.store).toBe(initialStore);
    expect(result.current.produceGetterResult).toBe(initialStore);

    rerender(newStore);

    expect(result.current.store).toBe(newStore);
    expect(result.current.produceGetterResult).toBe(newStore);

    unmount();
  });
});
