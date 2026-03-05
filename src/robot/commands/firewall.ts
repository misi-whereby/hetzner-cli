import type { Command } from "commander";
import { success } from "../../shared/formatter.js";
import {
  type ActionOptions,
  asyncAction,
  confirmAction,
  output,
} from "../../shared/helpers.js";
import { formatFirewall, formatFirewallTemplateList } from "../formatter.js";

export function registerFirewallCommands(parent: Command): void {
  const firewall = parent
    .command("firewall")
    .description("Firewall management");

  firewall
    .command("get <server>")
    .alias("show")
    .description("Get firewall configuration")
    .action(
      asyncAction(
        async (client, serverIdOrIp: string, options: ActionOptions) => {
          const { firewall: fw } = await client.getFirewall(serverIdOrIp);
          output(fw, formatFirewall, options);
        }
      )
    );

  firewall
    .command("enable <server>")
    .description("Enable firewall")
    .action(
      asyncAction(async (client, serverIdOrIp: string) => {
        await client.updateFirewall(serverIdOrIp, "active");
        console.log(success("Firewall enabled."));
      })
    );

  firewall
    .command("disable <server>")
    .description("Disable firewall")
    .action(
      asyncAction(async (client, serverIdOrIp: string) => {
        await client.updateFirewall(serverIdOrIp, "disabled");
        console.log(success("Firewall disabled."));
      })
    );

  firewall
    .command("delete <server>")
    .description("Delete all firewall rules")
    .option("-y, --yes", "Skip confirmation")
    .action(
      asyncAction(
        async (client, serverIdOrIp: string, options: ActionOptions) => {
          if (!(await confirmAction("Delete all firewall rules?", options))) {
            return;
          }
          await client.deleteFirewall(serverIdOrIp);
          console.log(success("Firewall rules deleted."));
        }
      )
    );

  const fwTemplate = firewall
    .command("template")
    .description("Firewall template management");

  fwTemplate
    .command("list")
    .alias("ls")
    .description("List firewall templates")
    .action(
      asyncAction(async (client, options: ActionOptions) => {
        const templates = await client.listFirewallTemplates();
        output(templates, formatFirewallTemplateList, options);
      })
    );

  fwTemplate
    .command("get <id>")
    .alias("show")
    .description("Get firewall template details")
    .action(
      asyncAction(
        async (client, templateId: string, options: ActionOptions) => {
          const { firewall_template: tmpl } = await client.getFirewallTemplate(
            Number.parseInt(templateId, 10)
          );
          output(
            tmpl,
            (t) => formatFirewallTemplateList([{ firewall_template: t }]),
            options
          );
        }
      )
    );

  fwTemplate
    .command("delete <id>")
    .alias("rm")
    .description("Delete firewall template")
    .option("-y, --yes", "Skip confirmation")
    .action(
      asyncAction(
        async (client, templateId: string, options: ActionOptions) => {
          if (
            !(await confirmAction(
              `Delete firewall template ${templateId}?`,
              options
            ))
          ) {
            return;
          }
          await client.deleteFirewallTemplate(Number.parseInt(templateId, 10));
          console.log(success("Firewall template deleted."));
        }
      )
    );
}
