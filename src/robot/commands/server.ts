import type { Command } from "commander";
import { success } from "../../shared/formatter.js";
import {
  type ActionOptions,
  asyncAction,
  output,
} from "../../shared/helpers.js";
import { formatServerDetails, formatServerList } from "../formatter.js";

export function registerServerCommands(parent: Command): void {
  const server = parent
    .command("server")
    .alias("servers")
    .description("Server management");

  server
    .command("list")
    .alias("ls")
    .description("List all servers")
    .action(
      asyncAction(async (client, options: ActionOptions) => {
        const servers = await client.listServers();
        output(servers, formatServerList, options);
      })
    );

  server
    .command("get <server>")
    .alias("show")
    .description("Get server details")
    .action(
      asyncAction(
        async (client, serverIdOrIp: string, options: ActionOptions) => {
          const { server: srv } = await client.getServer(serverIdOrIp);
          output(srv, formatServerDetails, options);
        }
      )
    );

  server
    .command("rename <server> <name>")
    .description("Rename a server")
    .action(
      asyncAction(async (client, serverIdOrIp: string, name: string) => {
        await client.updateServerName(serverIdOrIp, name);
        console.log(success(`Server renamed to: ${name}`));
      })
    );
}
