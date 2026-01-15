import { CLIApp } from "@cleverjs/cli";
import { RunCommand } from "./runCMD";
import { Logger } from "./utils/logger";

await new CLIApp({
    logger: Logger
})

    .register(new RunCommand())

    .handle(process.argv.slice(2), "shell");
