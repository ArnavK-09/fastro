import { h } from "https://esm.sh/preact@10.17.1";

// User component with props get from the server handler
export default function User(props: { data: string }) {
  return <h1>Hello {props.data}</h1>;
}