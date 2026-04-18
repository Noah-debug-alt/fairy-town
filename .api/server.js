
import { handler } from "@api/handler";
import { endpoints } from "@api/routers";
import express from "express";

const { PORT = 3000, PUBLIC_DIR = "import.meta.env.PUBLIC_DIR" } = process.env;
const server = express();
server.use(express.json());
server.use("import.meta.env.BASE", express.static(PUBLIC_DIR));
server.use("import.meta.env.BASE_API", handler);
server.listen(PORT, () => {
  console.log(`Ready at http://localhost:${PORT}`);
  console.log(endpoints);
});
