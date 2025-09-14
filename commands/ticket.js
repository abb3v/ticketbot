const botoptions = require("../options.json");
const mongoose = require("mongoose");
const ticketmodel = require('../ticketmodel.js');
const { getStandardEmbed } = require("../util/messages.js");
const { PermissionFlagsBits } = require("discord.js");

let command = {
    name: "ticket",
    name_localizations: {
        "de": "ticket",
        "en-GB": "ticket",
        "en-US": "ticket",
    },
    description: "Create a ticket",
    description_localizations: {
        "de": "Erstelle ein Ticket",
        "en-GB": "Create a ticket",
        "en-US": "Create a ticket",
    },
    dm_permission: false,
    options: [
        {
            type: 1,
            name: "close",
            description: "Close a Ticket",
        },
        {
            type: 1,
            name: "archive",
            description: "Archive a Ticket",
        },
        {
            type: 1,
            name: "delete",
            description: "Delete a Ticket",
        }
    ]
}

/**
 * 
 * @param {import("discord.js").Interaction} interaction
 * @returns 
 */
let executeCommand = async function executeCommand(interaction, getLocale) {
    let ticketDoc = await ticketmodel.findOne({ ticketid: interaction.channel.id });

    if (!ticketDoc) {
        interaction.reply({
            content: `<:KMC_rotesx:995387682643509329> This command only works in a Ticket channel!`,
            ephemeral: true,
        })
        return;
    }

    let channel = interaction.channel

    if (!channel) {
        interaction.reply({
            content: `<:KMC_rotesx:995387682643509329> This Ticket does not exist!`,
            ephemeral: true,
        })
        return;
    }

    if (interaction.options.getSubcommand() === "close") {
        if (ticketDoc.archived === true) {
            interaction.reply({
                content: "<:KMC_rotesx:995387682643509329> You cannot unlock an archived Ticket",
                ephemeral: true,
            }).catch(console.error)
            return;
        }
        if (ticketDoc.closed === true) {
            interaction.reply({
                content: "<a:KMC_loading:1005352031457906788> Unlocking Ticket...",
                ephemeral: true,
            }).catch(console.error)

            await ticketmodel.findOneAndUpdate({ ticketid: ticketDoc.ticketid }, { $set: { closed: false } }, { returnOriginal: false });

            await channel.permissionOverwrites.create(ticketDoc.userId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            }).catch(console.error)

            channel.send({
                "content": ``,
                "ephemeral": false,
                "embeds": [ getStandardEmbed(`🔒 **This Ticket has been unlocked by ${interaction.user}**`) ]
            });

            setTimeout(() => {
                interaction.deleteReply().catch(console.error)
            }, 100)
        } else {
            interaction.reply({
                content: "<a:KMC_loading:1005352031457906788> Closing Ticket...",
                ephemeral: true,
            }).catch(console.error)

            await ticketmodel.findOneAndUpdate({ ticketid: ticketDoc.ticketid }, { $set: { closed: true } }, { returnOriginal: false });

            await channel.permissionOverwrites.create(ticketDoc.userId, {
                ViewChannel: true,
                SendMessages: false,
                ReadMessageHistory: true
            }).catch(console.error)

            channel.send({
                "content": ``,
                "ephemeral": false,
                "embeds": [ getStandardEmbed(`🔒 **This Ticket has been closed by ${interaction.user}**`) ]
            });

            setTimeout(() => {
                interaction.deleteReply().catch(console.error)
            }, 100)
        }
    }

    if (interaction.options.getSubcommand() === "archive") {
        if (!interaction.member.roles.cache.find(r => r.id === botoptions.ticketManagerRole) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            interaction.reply({
                content: "<:KMC_rotesx:995387682643509329> You don't have permission to do that!",
                ephemeral: true,
            }).catch(console.error)
            return
        }

        if (ticketDoc.closed === false) {
            interaction.reply({
                content: "<:KMC_rotesx:995387682643509329> A Ticket must be closed to archive it",
                ephemeral: true,
            }).catch(console.error)
            return;
        }

        if (ticketDoc.archived === true) {
            interaction.reply({
                content: "<a:KMC_loading:1005352031457906788> Restoring Ticket...",
                ephemeral: true,
            }).catch(console.error)

            await ticketmodel.findOneAndUpdate({ ticketid: ticketDoc.ticketid }, { $set: { archived: false, archivedAt: null } }, { returnOriginal: false });

            await channel.setParent(botoptions.ticketCategory).catch(console.error)

            channel.permissionOverwrites.create(ticketDoc.userId, {
                ViewChannel: true,
                SendMessages: false,
                ReadMessageHistory: true
            }).catch(console.error)

            await channel.permissionOverwrites.create(interaction.guild.roles.everyone, {
                ViewChannel: false,
                SendMessages: false,
                ReadMessageHistory: false
            }).catch(console.error)

            channel.permissionOverwrites.create(botoptions.ticketManagerRole, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            }).catch(console.error)

            channel.send({
                "content": ``,
                "ephemeral": false,
                "embeds": [ getStandardEmbed(`📂 **This Ticket has been restored**`) ]
            });

            setTimeout(() => {
                interaction.deleteReply().catch(console.error)
            }, 100)
        } else {
            interaction.reply({
                content: "<a:KMC_loading:1005352031457906788> Archiving Ticket...",
                ephemeral: true,
            }).catch(console.error)

            await ticketmodel.findOneAndUpdate({ ticketid: ticketDoc.ticketid }, { $set: { archived: true, archivedAt: new Date() } }, { returnOriginal: false });

            await channel.setParent(botoptions.archiveId).catch(console.error)

            channel.permissionOverwrites.create(ticketDoc.userId, {
                ViewChannel: true,
                SendMessages: false,
                ReadMessageHistory: true
            }).catch(console.error)

            await channel.permissionOverwrites.create(interaction.guild.roles.everyone, {
                ViewChannel: false,
                SendMessages: false,
                ReadMessageHistory: false
            }).catch(console.error)

            channel.permissionOverwrites.create(botoptions.ticketManagerRole, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            }).catch(console.error)

            channel.send({
                "content": ``,
                "ephemeral": false,
                "embeds": [ getStandardEmbed(`📁 **This Ticket has been archived**`) ]
            });

            setTimeout(() => {
                interaction.deleteReply().catch(console.error)
            }, 100)
        }
    }

    if (interaction.options.getSubcommand() === "delete") {
        if (!interaction.member.roles.cache.find(r => r.id === botoptions.ticketManagerRole) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            interaction.reply({
                content: "<:KMC_rotesx:995387682643509329> You don't have permission to do that!",
                ephemeral: true,
            }).catch(console.error)
            return
        }

        if (ticketDoc.closed === false) {
            interaction.reply({
                content: "<:KMC_rotesx:995387682643509329> A Ticket must be closed to delete it",
                ephemeral: true,
            }).catch(console.error)
            return;
        }

        interaction.reply({
            "content": ``,
            "ephemeral": false,
            "embeds": [ getStandardEmbed(`❗ Are you sure you want to delete this ticket?`) ],
            "components": [
                {
                    "type": 1,
                    "components": [
                        {
                            "style": 4,
                            "label": "Delete Ticket",
                            "custom_id": `tdel_${channel.id}`,
                            "disabled": false,
                            "type": 2
                        },
                        {
                            "style": 2,
                            "label": "Cancel",
                            "custom_id": `cancel`,
                            "disabled": false,
                            "type": 2
                        },
                    ]
                }
            ]
        });
    }
}

module.exports.command = command;
module.exports.executeCommand = executeCommand;
