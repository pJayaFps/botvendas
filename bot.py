import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import discord
from discord.ext import commands, tasks

DB_PATH = "farming.db"
UTC = timezone.utc


def now_utc() -> datetime:
    return datetime.now(tz=UTC)


def next_due(period: str, start: Optional[datetime] = None) -> datetime:
    base = start or now_utc()
    return base + (timedelta(days=7) if period == "semanal" else timedelta(days=30))


@dataclass
class MetaConfig:
    id: int
    guild_id: int
    role_id: int
    item: str
    target_amount: int
    period: str


class FarmingDB:
    def __init__(self, path: str):
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        cur = self.conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS metas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id INTEGER NOT NULL,
                role_id INTEGER NOT NULL,
                item TEXT NOT NULL,
                target_amount INTEGER NOT NULL,
                period TEXT NOT NULL CHECK (period IN ('semanal','mensal')),
                created_at TEXT NOT NULL,
                UNIQUE(guild_id, role_id, item COLLATE NOCASE)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                meta_id INTEGER NOT NULL,
                cycle_amount INTEGER NOT NULL DEFAULT 0,
                total_amount INTEGER NOT NULL DEFAULT 0,
                cycle_due_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(guild_id, user_id, meta_id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS farm_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                meta_id INTEGER NOT NULL,
                item TEXT NOT NULL,
                amount INTEGER NOT NULL,
                note TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS panel_state (
                guild_id INTEGER PRIMARY KEY,
                channel_id INTEGER NOT NULL,
                message_id INTEGER NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        self.conn.commit()

    def upsert_meta(self, guild_id: int, role_id: int, item: str, target_amount: int, period: str) -> None:
        cur = self.conn.cursor()
        cur.execute(
            """
            INSERT INTO metas(guild_id, role_id, item, target_amount, period, created_at)
            VALUES(?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, role_id, item)
            DO UPDATE SET target_amount = excluded.target_amount, period = excluded.period
            """,
            (guild_id, role_id, item.strip(), target_amount, period, now_utc().isoformat()),
        )
        self.conn.commit()

    def list_metas(self, guild_id: int) -> list[MetaConfig]:
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM metas WHERE guild_id = ? ORDER BY item", (guild_id,))
        rows = cur.fetchall()
        return [MetaConfig(**dict(r)) for r in rows]

    def find_meta_by_item_for_roles(self, guild_id: int, role_ids: list[int], item: str) -> Optional[MetaConfig]:
        if not role_ids:
            return None
        placeholders = ",".join("?" for _ in role_ids)
        cur = self.conn.cursor()
        cur.execute(
            f"""
            SELECT * FROM metas
            WHERE guild_id = ? AND role_id IN ({placeholders}) AND lower(item) = lower(?)
            ORDER BY target_amount DESC
            LIMIT 1
            """,
            [guild_id, *role_ids, item.strip()],
        )
        row = cur.fetchone()
        return MetaConfig(**dict(row)) if row else None

    def get_meta(self, meta_id: int) -> MetaConfig:
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM metas WHERE id = ?", (meta_id,))
        return MetaConfig(**dict(cur.fetchone()))

    def get_progress(self, guild_id: int, user_id: int, meta_id: int) -> sqlite3.Row:
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM progress WHERE guild_id=? AND user_id=? AND meta_id=?", (guild_id, user_id, meta_id))
        row = cur.fetchone()
        if row:
            return row
        due = next_due(self.get_meta(meta_id).period)
        cur.execute(
            """
            INSERT INTO progress(guild_id, user_id, meta_id, cycle_amount, total_amount, cycle_due_at, updated_at)
            VALUES(?, ?, ?, 0, 0, ?, ?)
            """,
            (guild_id, user_id, meta_id, due.isoformat(), now_utc().isoformat()),
        )
        self.conn.commit()
        cur.execute("SELECT * FROM progress WHERE guild_id=? AND user_id=? AND meta_id=?", (guild_id, user_id, meta_id))
        return cur.fetchone()

    def add_farm(self, guild_id: int, user_id: int, meta: MetaConfig, amount: int, note: Optional[str]) -> sqlite3.Row:
        prog = self.get_progress(guild_id, user_id, meta.id)
        due = datetime.fromisoformat(prog["cycle_due_at"])
        cycle = int(prog["cycle_amount"])
        total = int(prog["total_amount"])
        if due <= now_utc():
            cycle = 0
            due = next_due(meta.period)
        cycle += amount
        total += amount
        cur = self.conn.cursor()
        cur.execute(
            """
            UPDATE progress SET cycle_amount=?, total_amount=?, cycle_due_at=?, updated_at=?
            WHERE guild_id=? AND user_id=? AND meta_id=?
            """,
            (cycle, total, due.isoformat(), now_utc().isoformat(), guild_id, user_id, meta.id),
        )
        cur.execute(
            """
            INSERT INTO farm_logs(guild_id,user_id,meta_id,item,amount,note,created_at)
            VALUES(?,?,?,?,?,?,?)
            """,
            (guild_id, user_id, meta.id, meta.item, amount, note, now_utc().isoformat()),
        )
        self.conn.commit()
        return self.get_progress(guild_id, user_id, meta.id)

    def user_metas(self, guild_id: int, user_id: int, role_ids: list[int]) -> list[tuple[MetaConfig, sqlite3.Row]]:
        return [(m, self.get_progress(guild_id, user_id, m.id)) for m in self.list_metas(guild_id) if m.role_id in role_ids]

    def ranking(self, guild_id: int, item: str, limit: int = 10) -> list[sqlite3.Row]:
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT p.user_id, p.cycle_amount, p.total_amount
            FROM progress p
            JOIN metas m ON m.id = p.meta_id
            WHERE p.guild_id = ? AND lower(m.item)=lower(?)
            ORDER BY p.cycle_amount DESC
            LIMIT ?
            """,
            (guild_id, item.strip(), limit),
        )
        return cur.fetchall()

    def rotate_due_cycles(self) -> int:
        cur = self.conn.cursor()
        cur.execute("SELECT id, meta_id, cycle_due_at FROM progress")
        rows = cur.fetchall()
        rotated = 0
        for row in rows:
            due = datetime.fromisoformat(row["cycle_due_at"])
            if due <= now_utc():
                period = self.get_meta(row["meta_id"]).period
                cur.execute(
                    "UPDATE progress SET cycle_amount=0, cycle_due_at=?, updated_at=? WHERE id=?",
                    (next_due(period).isoformat(), now_utc().isoformat(), row["id"]),
                )
                rotated += 1
        self.conn.commit()
        return rotated

    def save_panel(self, guild_id: int, channel_id: int, message_id: int) -> None:
        cur = self.conn.cursor()
        cur.execute(
            """
            INSERT INTO panel_state(guild_id, channel_id, message_id, updated_at)
            VALUES(?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id, message_id=excluded.message_id, updated_at=excluded.updated_at
            """,
            (guild_id, channel_id, message_id, now_utc().isoformat()),
        )
        self.conn.commit()


db = FarmingDB(DB_PATH)
intents = discord.Intents.default()
intents.guilds = True
intents.members = True
bot = commands.Bot(command_prefix="!", intents=intents)


def build_panel_embed() -> discord.Embed:
    return discord.Embed(
        title="🌾 Painel de Farming",
        description=(
            "Use os botões abaixo para configurar metas e registrar farms.\n\n"
            "• Configurar Farming (admin)\n"
            "• Ver Metas\n"
            "• Abrir Softfarm\n"
            "• Minha Meta\n"
            "• Ranking"
        ),
        color=discord.Color.blurple(),
    )


class ConfigDataModal(discord.ui.Modal, title="Configurar Meta"):
    item = discord.ui.TextInput(label="Item", placeholder="farinha", max_length=50)
    meta = discord.ui.TextInput(label="Meta (quantidade)", placeholder="20000", max_length=12)
    periodo = discord.ui.TextInput(label="Período", placeholder="semanal ou mensal", max_length=10)

    def __init__(self, role_id: int):
        super().__init__()
        self.role_id = role_id

    async def on_submit(self, interaction: discord.Interaction) -> None:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("Apenas administrador configura metas.", ephemeral=True)
            return
        try:
            target = int(str(self.meta).strip())
            if target <= 0:
                raise ValueError
        except ValueError:
            await interaction.response.send_message("Meta inválida. Use um número inteiro positivo.", ephemeral=True)
            return
        period = str(self.periodo).strip().lower()
        if period not in {"semanal", "mensal"}:
            await interaction.response.send_message("Período inválido. Use semanal ou mensal.", ephemeral=True)
            return

        db.upsert_meta(interaction.guild_id, self.role_id, str(self.item).strip(), target, period)
        role = interaction.guild.get_role(self.role_id)
        await interaction.response.send_message(
            f"✅ Meta salva: **{role.name if role else self.role_id}** • **{self.item}** • **{target}** • **{period}**",
            ephemeral=True,
        )


class RolePickerView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=120)

    @discord.ui.select(cls=discord.ui.RoleSelect, placeholder="Selecione o cargo da meta", min_values=1, max_values=1)
    async def role_select(self, interaction: discord.Interaction, select: discord.ui.RoleSelect):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("Apenas administrador configura metas.", ephemeral=True)
            return
        role = select.values[0]
        await interaction.response.send_modal(ConfigDataModal(role.id))


class FarmModal(discord.ui.Modal, title="Abrir Softfarm"):
    item = discord.ui.TextInput(label="Item farmado", placeholder="farinha")
    quantidade = discord.ui.TextInput(label="Quantidade", placeholder="10000")
    observacao = discord.ui.TextInput(label="Observação (opcional)", required=False, style=discord.TextStyle.paragraph)

    async def on_submit(self, interaction: discord.Interaction) -> None:
        member = interaction.user
        role_ids = [r.id for r in member.roles]
        meta = db.find_meta_by_item_for_roles(interaction.guild_id, role_ids, str(self.item).strip())
        if not meta:
            await interaction.response.send_message("Você não possui meta para esse item com seus cargos.", ephemeral=True)
            return
        try:
            amount = int(str(self.quantidade).strip())
            if amount <= 0:
                raise ValueError
        except ValueError:
            await interaction.response.send_message("Quantidade inválida.", ephemeral=True)
            return

        prog = db.get_progress(interaction.guild_id, member.id, meta.id)
        if int(prog["cycle_amount"]) >= meta.target_amount:
            await interaction.response.send_message(f"Você já bateu a meta de **{meta.item}** neste ciclo.", ephemeral=True)
            return

        updated = db.add_farm(interaction.guild_id, member.id, meta, amount, str(self.observacao) or None)
        cycle = int(updated["cycle_amount"])
        due = datetime.fromisoformat(updated["cycle_due_at"]).strftime("%d/%m/%Y")
        status = "✅ Meta batida" if cycle >= meta.target_amount else "📈 Progresso atualizado"
        await interaction.response.send_message(
            f"{status}\nItem: **{meta.item}**\nCiclo: **{cycle}/{meta.target_amount}**\nFecha em: **{due}**",
            ephemeral=True,
        )


class RankingModal(discord.ui.Modal, title="Ranking por Item"):
    item = discord.ui.TextInput(label="Item", placeholder="farinha")

    async def on_submit(self, interaction: discord.Interaction) -> None:
        rows = db.ranking(interaction.guild_id, str(self.item).strip(), 10)
        if not rows:
            await interaction.response.send_message("Sem registros para esse item no ciclo atual.", ephemeral=True)
            return
        lines = []
        for idx, row in enumerate(rows, 1):
            member = interaction.guild.get_member(row["user_id"])
            name = member.mention if member else f"<@{row['user_id']}>"
            lines.append(f"**{idx}.** {name} • ciclo **{row['cycle_amount']}** • total **{row['total_amount']}**")
        embed = discord.Embed(title=f"🏆 Ranking • {self.item}", description="\n".join(lines), color=discord.Color.gold())
        await interaction.response.send_message(embed=embed, ephemeral=True)


class FarmingPanelView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="Configurar Farming", style=discord.ButtonStyle.primary, custom_id="farm:cfg")
    async def configure(self, interaction: discord.Interaction, _: discord.ui.Button):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("Apenas administrador usa esta opção.", ephemeral=True)
            return
        await interaction.response.send_message("Escolha o cargo para configurar a meta:", view=RolePickerView(), ephemeral=True)

    @discord.ui.button(label="Ver Metas", style=discord.ButtonStyle.secondary, custom_id="farm:metas")
    async def metas(self, interaction: discord.Interaction, _: discord.ui.Button):
        metas = db.list_metas(interaction.guild_id)
        if not metas:
            await interaction.response.send_message("Nenhuma meta configurada ainda.", ephemeral=True)
            return
        desc = []
        for i, m in enumerate(metas, 1):
            role = interaction.guild.get_role(m.role_id)
            desc.append(f"**{i}.** {role.mention if role else m.role_id} • `{m.item}` • `{m.target_amount}` • `{m.period}`")
        embed = discord.Embed(title="📌 Metas do Servidor", description="\n".join(desc), color=discord.Color.blurple())
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @discord.ui.button(label="Abrir Softfarm", style=discord.ButtonStyle.success, custom_id="farm:open")
    async def open_farm(self, interaction: discord.Interaction, _: discord.ui.Button):
        await interaction.response.send_modal(FarmModal())

    @discord.ui.button(label="Minha Meta", style=discord.ButtonStyle.secondary, custom_id="farm:mine")
    async def minha_meta(self, interaction: discord.Interaction, _: discord.ui.Button):
        rows = db.user_metas(interaction.guild_id, interaction.user.id, [r.id for r in interaction.user.roles])
        if not rows:
            await interaction.response.send_message("Você não tem metas associadas aos seus cargos.", ephemeral=True)
            return
        lines = []
        for meta, prog in rows:
            due = datetime.fromisoformat(prog["cycle_due_at"]).strftime("%d/%m/%Y")
            lines.append(f"`{meta.item}` • ciclo **{prog['cycle_amount']}/{meta.target_amount}** • total **{prog['total_amount']}** • fecha **{due}**")
        await interaction.response.send_message(embed=discord.Embed(title="📊 Minha Meta", description="\n".join(lines), color=discord.Color.green()), ephemeral=True)

    @discord.ui.button(label="Ranking", style=discord.ButtonStyle.secondary, custom_id="farm:rank")
    async def rank(self, interaction: discord.Interaction, _: discord.ui.Button):
        await interaction.response.send_modal(RankingModal())


async def ensure_panel() -> None:
    channel_id = os.getenv("PANEL_CHANNEL_ID")
    if not channel_id:
        print("PANEL_CHANNEL_ID não definido. Painel não será enviado automaticamente.")
        return
    channel = bot.get_channel(int(channel_id))
    if not isinstance(channel, discord.TextChannel):
        print("PANEL_CHANNEL_ID inválido ou sem acesso.")
        return
    msg = await channel.send(embed=build_panel_embed(), view=FarmingPanelView())
    db.save_panel(channel.guild.id, channel.id, msg.id)
    print(f"Painel enviado em #{channel.name}")


@bot.event
async def on_ready() -> None:
    bot.add_view(FarmingPanelView())
    print(f"Logado como {bot.user}")
    check_cycles.start()
    await ensure_panel()


@tasks.loop(minutes=30)
async def check_cycles() -> None:
    rotated = db.rotate_due_cycles()
    if rotated:
        print(f"Ciclos resetados: {rotated}")


def main() -> None:
    token = os.getenv("DISCORD_TOKEN")
    if not token:
        raise RuntimeError("Defina DISCORD_TOKEN no .env")
    bot.run(token)


if __name__ == "__main__":
    main()
