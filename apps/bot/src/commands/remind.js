const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const {
  REMINDER_DELIVERY_TYPES,
  REMINDER_SCHEDULE_TYPES
} = require("@analytics-platform/shared");

const WEEKDAY_CHOICES = Object.freeze([
  { name: "Sunday", value: "0" },
  { name: "Monday", value: "1" },
  { name: "Tuesday", value: "2" },
  { name: "Wednesday", value: "3" },
  { name: "Thursday", value: "4" },
  { name: "Friday", value: "5" },
  { name: "Saturday", value: "6" }
]);

function isValidTime(value) {
  return /^\d{2}:\d{2}$/.test(value);
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatScheduleLabel(scheduleType, scheduleTime, scheduleDate, weekday) {
  if (scheduleType === REMINDER_SCHEDULE_TYPES.ONCE) {
    return `One time on ${scheduleDate} at ${scheduleTime}`;
  }

  if (scheduleType === REMINDER_SCHEDULE_TYPES.WEEKLY) {
    const weekdayName = WEEKDAY_CHOICES.find((choice) => choice.value === String(weekday))?.name || "Selected day";
    return `Weekly on ${weekdayName} at ${scheduleTime}`;
  }

  return `Daily at ${scheduleTime}`;
}

function formatNextRun(nextRunAt) {
  if (!nextRunAt) {
    return "Will be scheduled after validation";
  }

  return `<t:${Math.floor(new Date(nextRunAt).getTime() / 1000)}:F>`;
}

function createReminderCommand() {
  return new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Create a Disclytics DM reminder")
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("Short reminder title")
        .setRequired(true)
        .setMaxLength(120)
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Reminder message")
        .setRequired(true)
        .setMaxLength(1000)
    )
    .addStringOption((option) =>
      option
        .setName("schedule")
        .setDescription("When the reminder should repeat")
        .setRequired(true)
        .addChoices(
          { name: "One time", value: REMINDER_SCHEDULE_TYPES.ONCE },
          { name: "Daily", value: REMINDER_SCHEDULE_TYPES.DAILY },
          { name: "Weekly", value: REMINDER_SCHEDULE_TYPES.WEEKLY }
        )
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("24-hour time in HH:MM")
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(5)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Required for one-time reminders: YYYY-MM-DD")
        .setRequired(false)
        .setMinLength(10)
        .setMaxLength(10)
    )
    .addStringOption((option) =>
      option
        .setName("weekday")
        .setDescription("Required for weekly reminders")
        .setRequired(false)
        .addChoices(...WEEKDAY_CHOICES)
    )
    .addStringOption((option) =>
      option
        .setName("timezone")
        .setDescription("Optional IANA timezone like Asia/Calcutta")
        .setRequired(false)
        .setMaxLength(60)
    );
}

async function replyValidationError(interaction, message) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content: message, embeds: [] });
    return;
  }

  await interaction.reply({
    content: message,
    ephemeral: true
  });
}

async function handleReminderCommand(interaction, backendClient) {
  const title = interaction.options.getString("title", true).trim();
  const message = interaction.options.getString("message", true).trim();
  const scheduleType = interaction.options.getString("schedule", true);
  const scheduleTime = interaction.options.getString("time", true);
  const scheduleDate = interaction.options.getString("date");
  const weekday = interaction.options.getString("weekday");
  const timezone = interaction.options.getString("timezone")?.trim();

  if (!title) {
    await replyValidationError(interaction, "Reminder titles cannot be empty.");
    return;
  }

  if (!message) {
    await replyValidationError(interaction, "Reminder messages cannot be empty.");
    return;
  }

  if (!isValidTime(scheduleTime)) {
    await replyValidationError(interaction, "Use a valid 24-hour time like `09:30`.");
    return;
  }

  if (scheduleType === REMINDER_SCHEDULE_TYPES.ONCE && !scheduleDate) {
    await replyValidationError(interaction, "One-time reminders need a `date` in `YYYY-MM-DD` format.");
    return;
  }

  if (scheduleDate && !isValidDate(scheduleDate)) {
    await replyValidationError(interaction, "Use a valid date like `2026-04-07`.");
    return;
  }

  if (scheduleType === REMINDER_SCHEDULE_TYPES.WEEKLY && weekday == null) {
    await replyValidationError(interaction, "Weekly reminders need a `weekday`.");
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const { reminder } = await backendClient.post("/api/internal/reminders", {
      user: {
        userId: interaction.user.id,
        username: interaction.user.username,
        globalName: interaction.user.globalName || null,
        avatar: interaction.user.avatar || null,
        timezone: timezone || undefined
      },
      guild: interaction.guild ? {
        guildId: interaction.guildId,
        name: interaction.guild.name,
        icon: interaction.guild.icon || null
      } : undefined,
      title,
      message,
      scheduleType,
      scheduleTime,
      scheduleDate: scheduleType === REMINDER_SCHEDULE_TYPES.ONCE ? scheduleDate : undefined,
      scheduleDays: scheduleType === REMINDER_SCHEDULE_TYPES.WEEKLY ? [Number(weekday)] : [],
      timezone: timezone || undefined,
      deliveryModes: [REMINDER_DELIVERY_TYPES.DM]
    });

    const embed = new EmbedBuilder()
      .setColor(0x2563eb)
      .setTitle("Reminder created")
      .setDescription("Disclytics will DM you when this reminder is due.")
      .addFields(
        { name: "Title", value: title, inline: true },
        { name: "Schedule", value: formatScheduleLabel(scheduleType, scheduleTime, scheduleDate, weekday), inline: true },
        { name: "Next run", value: formatNextRun(reminder.next_run_at), inline: false },
        { name: "Timezone", value: reminder.timezone, inline: true }
      )
      .setFooter({
        text: "Delivery mode: DM"
      })
      .setTimestamp();

    await interaction.editReply({
      content: "",
      embeds: [embed]
    });
  } catch (error) {
    const responseMessage = error.responseBody?.error || error.responseBody?.message || "Failed to create reminder.";
    await interaction.editReply({
      content: responseMessage,
      embeds: []
    });
  }
}

module.exports = {
  createReminderCommand,
  handleReminderCommand
};
