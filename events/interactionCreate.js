const path = require('node:path');
const fs = require("fs");
const options = require("../options.json");
const ticketmodal = require('../ticketmodel.js');
const { getStandardEmbed, getTicketMessage } = require("../util/messages.js");

/**
 * Find a button file
 * @param {String} dir - The path to the button directory
 * @param {String} buttonId - The id of the button
 * @returns {String} - The path to the button file
 */
function findButtonFile(dir, buttonId) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (!stat.isDirectory()) {
            const buttonModule = require(fullPath);
            if (buttonModule && buttonModule.buttonId === buttonId) return fullPath;
        }
        
        if (stat.isDirectory()) {
            const result = findButtonFile(fullPath, buttonId);
            if (result) return result;
        }
    }
}

function checkButton(interaction) {
    if (interaction.isButton()) {
        const buttonsDir = path.join(process.cwd(), 'buttons');

        const filePath = findButtonFile(buttonsDir, interaction.customId);
        if (!filePath) return;
        const buttonModule = require(filePath);
        if (buttonModule) buttonModule.clickButton(interaction);
        return;
    }
}

module.exports = {
    name: 'interactionCreate',
    /**
     * Execute the command
     * @param {import('discord.js').Interaction} interaction - The interaction that triggered the command
     */
    async execute(interaction) {

        if (interaction.isCommand()) {
            const { commandName, options } = interaction;
            const commandDir = path.resolve(`${process.cwd()}${path.sep}commands`);

            if (fs.existsSync(`${commandDir}${path.sep}${commandName}.js`)) {

                let commandFile = require(`${commandDir}${path.sep}${commandName}.js`);

                commandFile.executeCommand(interaction);

                return;
            }
        }

        checkButton(interaction);

        if (interaction.isButton()) {

            if (interaction.customId.split("_")[0] === "tclose") {
                let channelID = interaction.customId.split("_")[1];
                let ticketDoc = await ticketmodal.findOne({ ticketid: channelID });
                
                if (!ticketDoc) {
                    interaction.reply({
                        content: `<:KMC_rotesx:995387682643509329> This Ticket does not exist!`,
                        ephemeral: true,
                    })
                    return;
                }

                let channel = await interaction.client.channels.fetch(channelID);

                if (!channel) {
                    interaction.reply({
                        content: `<:KMC_rotesx:995387682643509329> This Ticket does not exist!`,
                        ephemeral: true,
                    })
                    return;
                }

                if (ticketDoc.closed === true) {
                    if (ticketDoc.archived === true) {
                        interaction.reply({
                            content: "<:KMC_rotesx:995387682643509329> You cannot unlock an archived Ticket",
                            ephemeral: true,
                        }).catch(console.error)
                        return;
                    }

                    await ticketmodal.findOneAndUpdate({ ticketid: ticketDoc.ticketid }, { closed: false }, { returnOriginal: false });

                    await channel.permissionOverwrites.create(ticketDoc.userId, {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true
                    }).catch(console.error)

                    interaction.deferUpdate();

                    channel.send({
                        "content": ``,
                        "ephemeral": false,
                        "embeds": [ getStandardEmbed(`🔓 **This Ticket has been unlocked by ${interaction.user}**`) ]
                    });
                } else {
                    await ticketmodal.findOneAndUpdate({ ticketid: ticketDoc.ticketid }, { closed: true }, { returnOriginal: false });

                    await channel.permissionOverwrites.create(ticketDoc.userId, {
                        ViewChannel: true,
                        SendMessages: false,
                        ReadMessageHistory: true
                    }).catch(console.error)

                    interaction.deferUpdate();

                    channel.send({
                        "content": ``,
                        "ephemeral": false,
                        "embeds": [ getStandardEmbed(`🔓 **This Ticket has been closed by ${interaction.user}**`) ]
                    });
                }
            }
            
            if (interaction.customId.split("_")[0] === "tdel") {
                let channelID = interaction.customId.split("_")[1];
                let ticketDoc = await ticketmodal.findOne({ ticketid: channelID });
                
                if (!ticketDoc) {
                    interaction.reply({
                        content: `<:KMC_rotesx:995387682643509329> This Ticket does not exist!`,
                        ephemeral: true,
                    })
                    return;
                }

                let channel = await interaction.client.channels.fetch(channelID);

                if (!channel) {
                    interaction.reply({
                        content: `<:KMC_rotesx:995387682643509329> This Ticket does not exist!`,
                        ephemeral: true,
                    })
                    return;
                }

                if (!interaction.member.roles.cache.find(r => r.id === options.ticketManagerRole)) {
                    interaction.reply({
                        content: "<:KMC_rotesx:995387682643509329> You don't have permission to do that!",
                        ephemeral: true,
                    }).catch(console.error)
                    return
                }

                if (ticketDoc.closed === false) {
                    interaction.reply({
                        content: `<:KMC_rotesx:995387682643509329> You cannot delete a Ticket, that is still open!`,
                        ephemeral: true,
                    })
                    return;
                }

                await ticketmodal.findOneAndDelete({ ticketid: ticketDoc.ticketid });

                channel.delete();
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith("t_create")) {
                const projectID = interaction.customId.split("-")[1];
                const project = options.projects.find(p => p.id === projectID);

                interaction.reply({
                    content: "<a:KMC_loading:1005352031457906788> Creating Ticket...",
                    ephemeral: true,
                });

                const fields = project.fields.map(field => {
                    return {
                        label: field.name,
                        value: interaction.fields.getTextInputValue(field.id)
                    }
                })

                interaction.guild.channels.create({
                    name: `${interaction.user.globalName}-${project.id}`,
                    type: 0,
                })
                    .catch((err) => {
                        console.error(err);
                        setTimeout(() => {
                            interaction.editReply({
                                content: `<:KMC_rotesx:995387682643509329> There was an error whilst creating your Ticket!`,
                                ephemeral: true,
                            });
                        }, 1000);
                    })
                    .then(async (channel) => {
                        if (!channel) {
                            setTimeout(() => {
                                interaction.editReply({
                                    content: `<:KMC_rotesx:995387682643509329> There was an error whilst creating your Ticket!`,
                                    ephemeral: true,
                                });
                            }, 1000);
                            return;
                        }

                        channel.setParent(options.ticketCategory).catch(console.error)

                        let newTicket = await ticketmodal.create({ userId: interaction.user.id, ticketid: channel.id, project: project.id });

                        setTimeout(async () => {
                            interaction.editReply({
                                content: `<:KMC_BlauerHaken:987665905041424474> Your ticket has been created: <#${channel.id}>`,
                                ephemeral: true,
                            }).catch(console.error)

                            channel.permissionOverwrites.create(interaction.member, {
                                ViewChannel: true,
                                SendMessages: true,
                                ReadMessageHistory: true
                            }).catch(console.error)

                            await channel.permissionOverwrites.create(interaction.guild.roles.everyone, {
                                ViewChannel: false,
                                SendMessages: false,
                                ReadMessageHistory: false
                            }).catch(console.error)

                            channel.permissionOverwrites.create(options.ticketManagerRole, {
                                ViewChannel: true,
                                SendMessages: true,
                                ReadMessageHistory: true
                            }).catch(console.error)

                            channel.send(
                                getTicketMessage({
                                    channel,
                                    creator: interaction.user,
                                    project,
                                }, fields)
                            ).catch(console.error)

                        }, 1000)
                    });
            }

            if (interaction.customId.startsWith("other_t_create")) {
                const projectID = interaction.customId.split("-")[1];
                const project = options.projects.find(p => p.id === projectID);

                const problemdescription = interaction.fields.getTextInputValue("problemdescription");

                interaction.reply({
                    content: "<a:KMC_loading:1005352031457906788> Creating Ticket...",
                    ephemeral: true,
                });

                interaction.guild.channels.create({
                    name: `${interaction.user.globalName}-${project.id}`,
                    type: 0,
                })
                    .catch((err) => {
                        console.error(err);
                        setTimeout(() => {
                            interaction.editReply({
                                content: `<:KMC_rotesx:995387682643509329> There was an error whilst creating your Ticket!`,
                                ephemeral: true,
                            });
                        }, 1000);
                    })
                    .then(async (channel) => {
                        if (!channel) {
                            setTimeout(() => {
                                interaction.editReply({
                                    content: `<:KMC_rotesx:995387682643509329> There was an error whilst creating your Ticket!`,
                                    ephemeral: true,
                                });
                            }, 1000);
                            return;
                        }

                        channel.setParent(options.ticketCategory).catch(console.error)

                        let newTicket = await ticketmodal.create({ userId: interaction.user.id, ticketid: channel.id, project: project.id });

                        setTimeout(async () => {
                            interaction.editReply({
                                content: `<:KMC_BlauerHaken:987665905041424474> Your ticket has been created: <#${channel.id}>`,
                                ephemeral: true,
                            }).catch(console.error)

                            channel.permissionOverwrites.create(interaction.member, {
                                ViewChannel: true,
                                SendMessages: true,
                                ReadMessageHistory: true
                            }).catch(console.error)

                            await channel.permissionOverwrites.create(interaction.guild.roles.everyone, {
                                ViewChannel: false,
                                SendMessages: false,
                                ReadMessageHistory: false
                            }).catch(console.error)

                            channel.permissionOverwrites.create(options.ticketManagerRole, {
                                ViewChannel: true,
                                SendMessages: true,
                                ReadMessageHistory: true
                            }).catch(console.error)

                            channel.send(
                                getTicketMessage({
                                    channel,
                                    creator: interaction.user,
                                    project,
                                },
                                [
                                    {
                                        label: "Problem",
                                        value: problemdescription
                                    }
                                ])
                            ).catch(console.error)

                        }, 1000)
                    });
            }


            if (interaction.customId.startsWith("mcplugin_t_create")) {
                const projectID = interaction.customId.split("-")[1];
                const project = options.projects.find(p => p.id === projectID);

                const serversoftware = interaction.fields.getTextInputValue("serversoftware");
                const serverversion = interaction.fields.getTextInputValue("serverversion");
                const pluginversion = interaction.fields.getTextInputValue("pluginversion");
                const problemdescription = interaction.fields.getTextInputValue("problemdescription");

                interaction.reply({
                    content: "<a:KMC_loading:1005352031457906788> Creating Ticket...",
                    ephemeral: true,
                });

                interaction.guild.channels.create({
                    name: `${interaction.user.globalName}-${project.id}`,
                    type: 0,
                })
                    .catch((err) => {
                        console.error(err);
                        setTimeout(() => {
                            interaction.editReply({
                                content: `<:KMC_rotesx:995387682643509329> There was an error whilst creating your Ticket!`,
                                ephemeral: true,
                            });
                        }, 1000);
                    })
                    .then(async (channel) => {
                        if (!channel) {
                            setTimeout(() => {
                                interaction.editReply({
                                    content: `<:KMC_rotesx:995387682643509329> There was an error whilst creating your Ticket!`,
                                    ephemeral: true,
                                });
                            }, 1000);
                            return;
                        }

                        channel.setParent(options.ticketCategory).catch(console.error)

                        let newTicket = await ticketmodal.create({ userId: interaction.user.id, ticketid: channel.id, project: project.id });

                        setTimeout(async () => {
                            interaction.editReply({
                                content: `<:KMC_BlauerHaken:987665905041424474> Your ticket has been created: <#${channel.id}>`,
                                ephemeral: true,
                            }).catch(console.error)

                            channel.permissionOverwrites.create(interaction.member, {
                                ViewChannel: true,
                                SendMessages: true,
                                ReadMessageHistory: true
                            }).catch(console.error)

                            await channel.permissionOverwrites.create(interaction.guild.roles.everyone, {
                                ViewChannel: false,
                                SendMessages: false,
                                ReadMessageHistory: false
                            }).catch(console.error)

                            channel.permissionOverwrites.create(options.ticketManagerRole, {
                                ViewChannel: true,
                                SendMessages: true,
                                ReadMessageHistory: true
                            }).catch(console.error)

                            channel.send(
                                getTicketMessage({
                                    channel,
                                    creator: interaction.user,
                                    project,
                                },
                                [
                                    {
                                        label: "Server",
                                        value: `${serversoftware}, MC ${serverversion}`
                                    },
                                    {
                                        label: "Plugin Version",
                                        value: pluginversion
                                    },
                                    {
                                        label: "Problem",
                                        value: problemdescription
                                    }
                                ])
                            ).catch(console.error)
                        }, 1000)
                    });
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "project_select") {
                const projectId = interaction.values[0];
                const project = options.projects.find(p => p.id === projectId);

                if (!project) {
                    interaction.reply({
                        content: `<:KMC_rotesx:995387682643509329> This Project does not exist!`,
                        ephemeral: true,
                    })
                    return;
                }

                const getModal = require("../util/modals.js");
                const modal = getModal(project);
                await interaction.showModal(modal);
            }
        }

    }
}
