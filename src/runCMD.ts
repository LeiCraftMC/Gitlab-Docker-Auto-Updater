import { CLIBaseCommand, CLICommandArg, CLICommandArgParser, type CLICommandContext } from "@cleverjs/cli";
import { NtfyService } from "./services/ntfy";
import { Logger } from "./utils/logger";

const ARG_SPEC = CLICommandArg.defineCLIArgSpecs({
    flags: [

        // disabled for now
        // {
        //     name: "dry-run",
        //     description: "Perform a dry run without making any changes",
        //     type: "boolean"
        // },

        {
            name: "skip-backup",
            description: "Skip creating a backup before updating",
            type: "boolean"
        },
        {
            name: "delete-old-backups",
            description: "Delete backups older than the given time in days (default: 30). Set to 0 to disable deletion of old backups",
            type: "number",
            default: 30
        },
        {
            name: "backup-dir",
            description: "Directory to store backups. Defaults to './backups'",
            type: "string",
            default: "./backups"
        },
        {
            name: "gitlab-backup-dir",
            description: "Directory on the Host where Gitlab stores its backups. Defaults to '/var/opt/gitlab/backups'",
            type: "string",
            default: "/var/opt/gitlab/backups"
        },
        {
            name: "gitlab-env-file",
            description: "Path to the Gitlab .env file to include in the backup. By default, './.env' will be used if it exists",
            type: "string",
            default: "./.env"
        },
        

        {
            name: "docker-compose-file",
            description: "Path to the Docker Compose file. Defaults to './docker-compose.yml'",
            type: "string",
            default: "./docker-compose.yml"
        },
        {
            name: "docker-container-name",
            description: "Name of the Docker container running Gitlab. Defaults to 'gitlab' or the container_name specified in the Docker Compose file",
            type: "string",
            default: "gitlab"
        },

        {
            name: "ntfy-url",
            description: "URL for ntfy notifications. If not provided, notifications will be sent",
            type: "string"
        },
        {
            name: "ntfy-auth-token",
            description: "Authentication token for ntfy notifications",
            type: "string"
        }
    ]
});

export class RunCommand extends CLIBaseCommand<typeof ARG_SPEC> {

    constructor() {
        super({
            name: "run",
            description: "Run the Gitlab Docker Auto Updater",
            args: ARG_SPEC
        });
    }

    override async run(args: CLICommandArgParser.ParsedArgs<typeof ARG_SPEC>) {
        
        Logger.info("Starting Gitlab Docker Auto Updater...");

        let ntfyService: NtfyService | null = null;

        if (args.flags["ntfy-url"]) {
            ntfyService = new NtfyService(
                args.flags["ntfy-url"],
                args.flags["ntfy-auth-token"]
            )
        }

        


    }

}
