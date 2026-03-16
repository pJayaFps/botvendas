const { db } = require('../index');

const getTicketSettings = (botId = 1, guildId) => {
  return db.prepare('SELECT * FROM ticket_settings WHERE bot_id = ? AND guild_id = ?').get(botId, guildId);
};

const upsertTicketSettings = (data) => {
  const existing = db.prepare('SELECT id FROM ticket_settings WHERE bot_id = ? AND guild_id = ?').get(data.bot_id, data.guild_id);
  if (existing) {
    return db.prepare(`
      UPDATE ticket_settings
      SET panel_title = @panel_title,
          panel_description = @panel_description,
          ticket_category_id = @ticket_category_id,
          staff_role_id = @staff_role_id,
          opener_role_id = @opener_role_id,
          auto_message = @auto_message,
          log_channel_id = @log_channel_id,
          closed_category_id = @closed_category_id,
          delete_after_seconds = @delete_after_seconds,
          pix_qr_url = @pix_qr_url,
          pix_key = @pix_key,
          pix_receiver = @pix_receiver,
          pix_embed_message = @pix_embed_message,
          transcript_type = @transcript_type,
          transcript_channel_id = @transcript_channel_id,
          feedback_channel_id = @feedback_channel_id,
          updated_at = @updated_at
      WHERE bot_id = @bot_id AND guild_id = @guild_id
    `).run(data);
  }

  return db.prepare(`
    INSERT INTO ticket_settings (
      bot_id, guild_id, panel_title, panel_description, ticket_category_id, staff_role_id, opener_role_id,
      auto_message, log_channel_id, closed_category_id, delete_after_seconds,
      pix_qr_url, pix_key, pix_receiver, pix_embed_message,
      transcript_type, transcript_channel_id, feedback_channel_id, updated_at
    ) VALUES (
      @bot_id, @guild_id, @panel_title, @panel_description, @ticket_category_id, @staff_role_id, @opener_role_id,
      @auto_message, @log_channel_id, @closed_category_id, @delete_after_seconds,
      @pix_qr_url, @pix_key, @pix_receiver, @pix_embed_message,
      @transcript_type, @transcript_channel_id, @feedback_channel_id, @updated_at
    )
  `).run(data);
};

const createTicketRecord = ({ botId = 1, guildId, channelId, openedBy }) => {
  const createdAt = new Date().toISOString();
  return db.prepare(`
    INSERT INTO tickets (bot_id, guild_id, channel_id, opened_by, status, created_at)
    VALUES (?, ?, ?, ?, 'open', ?)
  `).run(botId, guildId, channelId, openedBy, createdAt);
};

const getTicketByChannel = (channelId) => db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);

const setTicketAssignee = (channelId, userId) => db.prepare('UPDATE tickets SET assumed_by = ? WHERE channel_id = ?').run(userId, channelId);

const closeTicketRecord = (channelId, closedBy, finalStatus, notes) => db.prepare(
  "UPDATE tickets SET status = 'closed', closed_by = ?, closed_at = ?, final_status = ?, close_notes = ? WHERE channel_id = ?"
).run(closedBy, new Date().toISOString(), finalStatus, notes, channelId);

module.exports = {
  getTicketSettings,
  upsertTicketSettings,
  createTicketRecord,
  getTicketByChannel,
  setTicketAssignee,
  closeTicketRecord
};
