import { Signal, Store } from '@dotm4x/fable';

const count = new Store(0);
const countChanges: string[] = [];
count.connect(({ previous, value }) => {
  countChanges.push(`${String(previous)} -> ${String(value)}`);
});
count.value += 1;

const message = new Signal<[text: string, repeat?: number]>();
const messages: string[] = [];
message.connect((text, repeat = 1) => {
  messages.push(text.repeat(repeat));
});
message.fire('Hello from the sandbox!');

if (countChanges[0] !== '0 -> 1' || messages[0] !== 'Hello from the sandbox!') {
  throw new Error('The sandbox examples did not run as expected.');
}
