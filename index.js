const { Client, Intents, User, GatewayIntentBits, Interaction, Constants, Collection, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, SelectMenuBuilder, ModalBuilder, TextInputBuilder, ActivityType, AutoModerationActionExecution } = require("discord.js");
const client = new Client({ partials: ["CHANNEL"], intents: 36355 });
require("dotenv").config();
const path = require('node:path');
const fs = require("fs");
const chalk = require("chalk");
const options = require("./options.json");
const mongoose = require("mongoose");
const ticketModel = require("./ticketmodel");

const devMode = process.env.NODE_ENV === "development";

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

if (devMode) console.log(chalk.default.red("Bot started in development mode!"));

mongoose.connect(process.env.MONGOURI, {}).then(() => console.log(chalk.default.greenBright("Connected to database")));

client.once("ready", async () => {
    /* --- Send confirmation messages --- */
    console.log(chalk.default.greenBright(`${chalk.default.yellow(client.user.tag)} is now online!`));
    console.log(chalk.default.greenBright(`${chalk.default.yellow(client.user.tag)} is on ${chalk.default.yellow(client.guilds.cache.size)} servers!`));

    setStatus();

    /* --- Initialize deletion schedule --- */
    deletionSchedule = setInterval(() => {
        const now = new Date();
        
        ticketModel.find({ archived: true }).then(async tickets => {
            for (const ticket of tickets) {
                const archivedAt = ticket.archivedAt;
                const difference = now - archivedAt;
                const differenceSeconds = difference / 1000;
                const differenceInHours = difference / (1000 * 60 * 60);
                
                if (differenceInHours >= 24) {
                    console.log(`${chalk.default.gray(">")} Deleting ticket ${ticket.ticketid} (by ${ticket.userId}) because it has been archived long enough...`);
                    const ticketChannel = await client.channels.fetch(ticket.ticketid);
                    if (ticketChannel) {
                        ticketChannel.delete().then(() => {
                            console.log(`${chalk.default.gray(">")} Deleted channel ${ticketChannel.name}`);
                        });
                    } else {
                        console.log(`${chalk.default.gray(">")} Ticketchannel ${ticket.ticketid} does not exist anymore!`);
                    }

                    ticketModel.deleteOne({ ticketid: ticket.ticketid }).then(() => {
                        console.log(`${chalk.default.gray(">")} Deleted ticket ${ticket.ticketid} successfully!\n`);
                    });
                }
            }
        });
    }, 1000 * 60 * 60);
    
    console.log(chalk.default.greenBright("Initialized deletion schedule!"));

    /* --- Register commands --- */
    const guildId = options.guildId;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
        console.log(chalk.default.red(`Guild with ID ${guildId} not found! Registering globally...`));
        commands = client.application.commands;
    } else {
        console.log(chalk.default.greenBright(`Registering commands in guild ${guild.name}`));
        commands = guild.commands;
    }

    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));


    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const commandFile = require(filePath);
        commands.create(commandFile.command)
    }
});

async function setStatus() {
    const tickets = await ticketModel.countDocuments();

    client.user.setPresence({
        activities: [{ name: `Managing ${tickets} open Tickets`, type: ActivityType.Custom }],
        status: 'online',
    });

    setInterval(async () => {
        const tickets = await ticketModel.countDocuments();

        client.user.setPresence({
            activities: [{ name: `Managing ${tickets} open Tickets`, type: ActivityType.Custom }],
            status: 'online',
        });
    }, 300000);
}

client.on("error", (err) => {
    console.log(err);
});
client.on("warn", console.warn);

process.on("unhandledRejection", (err) => {
    console.error(err);
});

client.login(process.env.TOKEN);
