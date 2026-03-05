import { checkbox, confirm, select } from "@inquirer/prompts";
import type { Command } from "commander";
import { error as fmtError, info } from "../../shared/formatter.js";
import { asyncAction } from "../../shared/helpers.js";
import type { HetznerRobotClient } from "../client.js";
import {
  formatFailoverSwitch,
  formatRescueActivation,
  formatResetResult,
  formatServerList,
  formatSshKeyList,
} from "../formatter.js";
import type { ResetType } from "../types.js";

async function handleServers(client: HetznerRobotClient): Promise<void> {
  const servers = await client.listServers();
  console.log("");
  console.log(formatServerList(servers));
  console.log("");
}

async function handleReset(client: HetznerRobotClient): Promise<boolean> {
  const servers = await client.listServers();
  if (servers.length === 0) {
    console.log(info("No servers found."));
    return false;
  }

  const selected = await checkbox({
    message: "Select servers to reset:",
    choices: servers.map(({ server }) => ({
      value: server.server_ip,
      name: `${server.server_number} - ${server.server_ip} (${server.server_name || "unnamed"})`,
    })),
  });

  if (selected.length === 0) {
    console.log("No servers selected.");
    return false;
  }

  const resetType = (await select({
    message: "Select reset type:",
    choices: [
      { value: "sw", name: "Software reset (ACPI)" },
      { value: "hw", name: "Hardware reset (forced)" },
      { value: "power", name: "Power cycle" },
    ],
  })) as ResetType;

  const confirmed = await confirm({
    message: `Reset ${selected.length} server(s) with ${resetType}?`,
    default: false,
  });

  if (confirmed) {
    for (const srv of selected) {
      try {
        const { reset: rst } = await client.resetServer(srv, resetType);
        console.log(formatResetResult(rst, resetType));
      } catch (err) {
        console.log(
          fmtError(
            `Failed to reset ${srv}: ${err instanceof Error ? err.message : "Unknown"}`
          )
        );
      }
    }
  }
  return true;
}

async function handleRescue(client: HetznerRobotClient): Promise<boolean> {
  const servers = await client.listServers();
  if (servers.length === 0) {
    console.log(info("No servers found."));
    return false;
  }

  const serverIp = await select({
    message: "Select server:",
    choices: servers.map(({ server }) => ({
      value: server.server_ip,
      name: `${server.server_number} - ${server.server_ip} (${server.server_name || "unnamed"})`,
    })),
  });

  const os = await select({
    message: "Select rescue OS:",
    choices: [
      { value: "linux", name: "Linux (64-bit)" },
      { value: "linuxold", name: "Linux (32-bit)" },
      { value: "vkvm", name: "vKVM" },
    ],
  });

  const { rescue } = await client.activateRescue(serverIp, os, 64);
  console.log("");
  console.log(formatRescueActivation(rescue));
  return true;
}

async function handleFailover(client: HetznerRobotClient): Promise<boolean> {
  const failovers = await client.listFailovers();
  if (failovers.length === 0) {
    console.log(info("No failover IPs found."));
    return false;
  }

  const failoverIp = await select({
    message: "Select failover IP:",
    choices: failovers.map(({ failover }) => ({
      value: failover.ip,
      name: `${failover.ip} -> ${failover.active_server_ip}`,
    })),
  });

  const servers = await client.listServers();
  const targetIp = await select({
    message: "Route to server:",
    choices: servers.map(({ server }) => ({
      value: server.server_ip,
      name: `${server.server_number} - ${server.server_ip}`,
    })),
  });

  const { failover: fo } = await client.switchFailover(failoverIp, targetIp);
  console.log("");
  console.log(formatFailoverSwitch(fo));
  return true;
}

async function handleKeys(client: HetznerRobotClient): Promise<void> {
  const keys = await client.listSshKeys();
  console.log("");
  console.log(formatSshKeyList(keys));
  console.log("");
}

export function registerInteractiveCommands(parent: Command): void {
  parent
    .command("interactive")
    .alias("i")
    .description("Interactive mode for common operations")
    .action(
      asyncAction(async (client) => {
        while (true) {
          const action = await select({
            message: "What would you like to do?",
            choices: [
              { value: "servers", name: "List servers" },
              { value: "reset", name: "Reset a server" },
              { value: "rescue", name: "Activate rescue mode" },
              { value: "failover", name: "Switch failover IP" },
              { value: "keys", name: "Manage SSH keys" },
              { value: "exit", name: "Exit" },
            ],
            pageSize: 10,
          });

          if (action === "exit") {
            console.log("Goodbye!");
            break;
          }

          if (action === "servers") {
            await handleServers(client);
          } else if (action === "reset") {
            await handleReset(client);
          } else if (action === "rescue") {
            await handleRescue(client);
          } else if (action === "failover") {
            await handleFailover(client);
          } else if (action === "keys") {
            await handleKeys(client);
          }

          console.log("");
        }
      })
    );
}
