import type { Command } from "commander";
import { success } from "../../shared/formatter.js";
import {
  type ActionOptions,
  asyncAction,
  confirmAction,
  output,
} from "../../shared/helpers.js";
import { formatFailoverList, formatFailoverSwitch } from "../formatter.js";

export function registerFailoverCommands(parent: Command): void {
  const failover = parent
    .command("failover")
    .description("Failover IP management");

  failover
    .command("list")
    .alias("ls")
    .description("List all failover IPs")
    .action(
      asyncAction(async (client, options: ActionOptions) => {
        const failovers = await client.listFailovers();
        output(failovers, formatFailoverList, options);
      })
    );

  failover
    .command("get <ip>")
    .alias("show")
    .description("Get failover IP details")
    .action(
      asyncAction(
        async (client, failoverIp: string, options: ActionOptions) => {
          const { failover: fo } = await client.getFailover(failoverIp);
          output(fo, (f) => formatFailoverList([{ failover: f }]), options);
        }
      )
    );

  failover
    .command("switch <failover-ip> <target-server-ip>")
    .description("Switch failover IP routing to another server")
    .option("-y, --yes", "Skip confirmation")
    .action(
      asyncAction(
        async (
          client,
          failoverIp: string,
          targetServerIp: string,
          options: ActionOptions
        ) => {
          if (
            !(await confirmAction(
              `Route ${failoverIp} to ${targetServerIp}?`,
              options,
              true
            ))
          ) {
            return;
          }
          const { failover: fo } = await client.switchFailover(
            failoverIp,
            targetServerIp
          );
          console.log(formatFailoverSwitch(fo));
        }
      )
    );

  failover
    .command("delete <ip>")
    .description("Delete failover IP routing")
    .option("-y, --yes", "Skip confirmation")
    .action(
      asyncAction(
        async (client, failoverIp: string, options: ActionOptions) => {
          if (
            !(await confirmAction(`Delete routing for ${failoverIp}?`, options))
          ) {
            return;
          }
          await client.deleteFailoverRouting(failoverIp);
          console.log(success("Failover routing deleted."));
        }
      )
    );
}
