import type { Command } from "commander";
import { info } from "../../shared/formatter.js";
import {
  type ActionOptions,
  asyncAction,
  output,
} from "../../shared/helpers.js";
import { formatWolResult } from "../formatter.js";

export function registerWolCommands(parent: Command): void {
  const wol = parent.command("wol").description("Wake on LAN");

  wol
    .command("status <server>")
    .description("Check WoL status for server")
    .action(
      asyncAction(
        async (client, serverIdOrIp: string, options: ActionOptions) => {
          const { wol: wolData } = await client.getWol(serverIdOrIp);
          output(
            wolData,
            (w) =>
              `Server: ${w.server_number} (${w.server_ip})\n${info("Wake on LAN is available for this server.")}`,
            options
          );
        }
      )
    );

  wol
    .command("send <server>")
    .description("Send Wake on LAN packet")
    .action(
      asyncAction(async (client, serverIdOrIp: string) => {
        const { wol: wolData } = await client.sendWol(serverIdOrIp);
        console.log(formatWolResult(wolData));
      })
    );
}
