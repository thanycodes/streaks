import { handle, type KV } from "./handler";

interface Env {
  /** Workers KV namespace, bound in wrangler.toml. */
  STREAKS: KV;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env.STREAKS);
  },
};
