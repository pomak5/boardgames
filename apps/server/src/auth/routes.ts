/** REST-роуты аккаунтов. Подключаются только при заданном DATABASE_URL. */
import type { FastifyInstance } from "fastify";
import {
  createUser,
  findUserByEmail,
  getUserById,
  getUserStats,
} from "@boardgames/db";
import { hashPassword, verifyPassword } from "./password";
import { payloadFromHeader, signToken } from "./jwt";

interface RegisterBody {
  email?: string;
  nickname?: string;
  password?: string;
}
interface LoginBody {
  email?: string;
  password?: string;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", async (req, reply) => {
    const { email, nickname, password } = (req.body ?? {}) as RegisterBody;
    if (!email || !nickname || !password)
      return reply.code(400).send({ error: "email, nickname и password обязательны" });
    if (password.length < 6)
      return reply.code(400).send({ error: "Пароль минимум 6 символов" });
    if (await findUserByEmail(email))
      return reply.code(409).send({ error: "Email уже занят" });
    const user = await createUser(email, nickname, await hashPassword(password));
    const token = await signToken({ userId: user.id, nickname: user.nickname });
    return reply.code(201).send({ token, user });
  });

  app.post("/auth/login", async (req, reply) => {
    const { email, password } = (req.body ?? {}) as LoginBody;
    if (!email || !password)
      return reply.code(400).send({ error: "email и password обязательны" });
    const row = await findUserByEmail(email);
    if (!row || !(await verifyPassword(password, row.passwordHash)))
      return reply.code(401).send({ error: "Неверный email или пароль" });
    const token = await signToken({ userId: row.id, nickname: row.nickname });
    return reply.send({
      token,
      user: {
        id: row.id,
        email: row.email,
        nickname: row.nickname,
        createdAt: row.createdAt,
      },
    });
  });

  app.get("/auth/me", async (req, reply) => {
    const payload = await payloadFromHeader(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: "Не авторизован" });
    const user = await getUserById(payload.userId);
    if (!user) return reply.code(404).send({ error: "Пользователь не найден" });
    const stats = await getUserStats(user.id);
    return reply.send({ user, stats });
  });
}
