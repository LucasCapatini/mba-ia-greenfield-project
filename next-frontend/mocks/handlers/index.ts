import { handlers as authHandlers } from "./auth";
import { handlers as categoriesHandlers } from "./categories";
import { handlers as channelsHandlers } from "./channels";
import { handlers as seedHandlers } from "./_seed";
import { handlers as videosHandlers } from "./videos";

export const handlers = [
  ...authHandlers,
  ...categoriesHandlers,
  ...channelsHandlers,
  ...videosHandlers,
  ...seedHandlers,
];
