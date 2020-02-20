import React, { FC, useState } from "react";

import { createStore } from "../src";

const { useCountA, useCountB, useProduce } = createStore(
  {
    countA: 5,
    countB: 15
  },
  {
    useCountA: ({ countA }, arg: { a: string }) => {
      return arg.a + " - " + countA;
    },
    useCountB: ({ countB }) => {
      return countB;
    }
  }
);

const CountA: FC = () => {
  const [a, setA] = useState("asd");

  const count = useCountA({ a });

  const { produce, asyncProduce } = useProduce();

  return (
    <div>
      <input value={a} onChange={({ target: { value } }) => setA(value)} />
      <br />
      <br />
      <br />
      <br />
      <button
        onClick={() => {
          asyncProduce(async draft => {
            draft.countA = 0;
          });
        }}
      >
        Async produce A
      </button>
      <br />
      <br />
      <br />
      <br />
      <button
        onClick={() => {
          produce(state => {
            state.countA -= 2;
          });
        }}
      >
        -
      </button>
      <span>{count}</span>
      <button
        onClick={() => {
          produce(state => {
            state.countA += 2;
          });
        }}
      >
        +
      </button>
      <br />
      <br />
      <span>{Math.round(Math.random() * 1000)}</span>
    </div>
  );
};
const CountB: FC = () => {
  const count = useCountB();
  const { produce } = useProduce();

  return (
    <div>
      <button
        onClick={() => {
          produce(state => {
            state.countB -= 1;
          });
        }}
      >
        -
      </button>
      <span>94 - {count}</span>
      <button
        onClick={() => {
          produce(state => {
            state.countB += 1;
          });
        }}
      >
        +
      </button>
      <br />
      <br />
      <span>{Math.round(Math.random() * 1000)}</span>
    </div>
  );
};

export const CountC = () => {
  const [a, setA] = useState("zxc");
  const count = useCountA({ a });
  return (
    <>
      <br />
      <input value={a} onChange={({ target: { value } }) => setA(value)} />

      <br />

      <br />
      <br />
      {Math.round(Math.random() * 1000)}

      <p>{count}</p>
    </>
  );
};

const Produce: FC = () => {
  const { asyncProduce } = useProduce();
  return (
    <>
      {Math.round(Math.random() * 1000)}
      <button
        onClick={async () => {
          await asyncProduce(async draft => {
            await new Promise(resolve => {
              setTimeout(resolve, 4000);
            });

            draft.countB += 100;
          });
        }}
      >
        Async produce B
      </button>
    </>
  );
};

export default {
  title: "Welcome"
};

export const toStorybook = () => (
  <>
    <CountA />
    <CountB />
    <CountC />
    <Produce />
  </>
);

toStorybook.story = {
  name: "to Storybook1"
};
