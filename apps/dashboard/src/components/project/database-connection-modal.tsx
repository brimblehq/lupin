import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { Dropdown, type DropdownOption } from "../shared/dropdown";
import { Modal, ModalCancelButton, ModalFooter, ModalHeader } from "../shared/modal";
import { decryptDatabaseConnectionUriServerFn } from "@/server/projects/actions";
import { maskSecretWithAsterisks } from "@/utils/dashboard";

interface DatabaseConnectionModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connectionUri?: string;
  isActive: boolean;
}

interface ParsedConnection {
  protocol: string;
  user: string;
  password: string;
  host: string;
  port: string;
  database: string;
}

type StackKey = "nextjs" | "node" | "python" | "go" | "php" | "java" | "rust";
type StackGuide = {
  file: string;
  install: string;
  code: string;
};
type DatabaseKind = "postgres" | "mysql" | "mongodb" | "redis";

const STACK_OPTIONS: DropdownOption[] = [
  { id: "nextjs", label: "Next.js" },
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
  { id: "php", label: "PHP" },
  { id: "java", label: "Java" },
  { id: "rust", label: "Rust" },
];
const HIGHLIGHT_RE = new RegExp(
  [
    "(?<comment>//[^\\n]*|/\\*[\\s\\S]*?\\*/|<!--[\\s\\S]*?-->)",
    "(?<string>\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)",
    "(?<tag></?[A-Za-z][\\w-]*|/?>)",
    "(?<attr>[A-Za-z][\\w-]*(?==))",
    "(?<keyword>\\b(?:import|from|export|default|function|const|let|var|return|if|else|for|while|new|null|true|false|undefined|typeof|async|await|class|extends|this|super|try|catch|finally|throw|package|main|func|with)\\b)",
    "(?<number>\\b\\d+\\b)",
    "(?<ident>[A-Za-z_$][\\w$]*)",
  ].join("|"),
  "g",
);
const TOKEN_CLASS: Record<string, string> = {
  comment: "italic text-dash-text-extra-faded",
  string: "text-[#0e7c66] dark:text-[#5eead4]",
  tag: "text-[#b4366b] dark:text-[#f9a8d4]",
  attr: "text-[#9a5b00] dark:text-[#fcd34d]",
  keyword: "text-[#7c3aed] dark:text-[#c4b5fd]",
  number: "text-[#9a5b00] dark:text-[#fcd34d]",
  ident: "",
};

function highlight(code: string) {
  const out: { text: string; cls: string }[] = [];
  let last = 0;
  for (const m of code.matchAll(HIGHLIGHT_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ text: code.slice(last, start), cls: "" });
    const type = Object.keys(m.groups ?? {}).find((k) => m.groups?.[k] != null) ?? "";
    out.push({ text: m[0], cls: TOKEN_CLASS[type] ?? "" });
    last = start + m[0].length;
  }
  if (last < code.length) out.push({ text: code.slice(last), cls: "" });
  return out;
}

function parseConnectionUri(uri: string): ParsedConnection | null {
  try {
    const url = new URL(uri);
    return {
      protocol: url.protocol.replace(":", ""),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      host: url.hostname,
      port: url.port,
      database: url.pathname.replace("/", ""),
    };
  } catch {
    return null;
  }
}

function getEnvPrefix(protocol: string): Record<string, string> {
  const p = protocol.toLowerCase();
  if (p === "mysql") {
    return { HOST: "MYSQL_HOST", PORT: "MYSQL_PORT", DATABASE: "MYSQL_DATABASE", USER: "MYSQL_USER", PASSWORD: "MYSQL_PASSWORD" };
  }
  if (p === "mongodb" || p === "mongodb+srv") {
    return { HOST: "MONGO_HOST", PORT: "MONGO_PORT", DATABASE: "MONGO_DATABASE", USER: "MONGO_USER", PASSWORD: "MONGO_PASSWORD" };
  }
  if (p === "redis" || p === "rediss") {
    return { HOST: "REDIS_HOST", PORT: "REDIS_PORT", DATABASE: "REDIS_DATABASE", USER: "REDIS_USER", PASSWORD: "REDIS_PASSWORD" };
  }
  return { HOST: "PGHOST", PORT: "PGPORT", DATABASE: "PGDATABASE", USER: "PGUSER", PASSWORD: "PGPASSWORD" };
}

function buildParamsText(parsed: ParsedConnection, showPassword: boolean): string {
  const prefix = getEnvPrefix(parsed.protocol);
  const pw = showPassword ? parsed.password : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  return [
    `${prefix.HOST}=${parsed.host}`,
    `${prefix.PORT}=${parsed.port}`,
    `${prefix.DATABASE}=${parsed.database}`,
    `${prefix.USER}=${parsed.user}`,
    `${prefix.PASSWORD}=${pw}`,
  ].join("\n");
}

function buildCopyableParams(parsed: ParsedConnection): string {
  const prefix = getEnvPrefix(parsed.protocol);
  return [
    `${prefix.HOST}=${parsed.host}`,
    `${prefix.PORT}=${parsed.port}`,
    `${prefix.DATABASE}=${parsed.database}`,
    `${prefix.USER}=${parsed.user}`,
    `${prefix.PASSWORD}=${parsed.password}`,
  ].join("\n");
}

function resolveDatabaseKind(protocol: string): DatabaseKind {
  const p = protocol.toLowerCase();
  if (p === "mysql") return "mysql";
  if (p === "mongodb" || p === "mongodb+srv") return "mongodb";
  if (p === "redis" || p === "rediss") return "redis";
  return "postgres";
}

function connectionEnvVar(kind: DatabaseKind): string {
  if (kind === "mongodb") return "MONGODB_URI";
  if (kind === "redis") return "REDIS_URL";
  return "DATABASE_URL";
}

function buildNextJsGuide(kind: DatabaseKind, envVar: string): StackGuide {
  if (kind === "postgres") {
    return {
      file: "app/lib/db.ts",
      install: "npm install pg",
      code: `"use server";
import { Pool, type PoolConfig } from "pg";

const connectionString = process.env.${envVar};
if (!connectionString) throw new Error("Missing ${envVar}");

const globalForDb = globalThis as unknown as { pgPool?: Pool };
const config: PoolConfig = {
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
};

export const db = globalForDb.pgPool ?? new Pool(config);
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = db;

export async function query<T = unknown>(text: string, params: unknown[] = []) {
  const result = await db.query<T>(text, params);
  return result.rows;
}`,
    };
  }

  if (kind === "mysql") {
    return {
      file: "app/lib/db.ts",
      install: "npm install mysql2",
      code: `"use server";
import mysql, { type PoolOptions } from "mysql2/promise";

const connectionUri = process.env.${envVar};
if (!connectionUri) throw new Error("Missing ${envVar}");

const globalForDb = globalThis as unknown as {
  mysqlPool?: mysql.Pool;
};

const config: PoolOptions = {
  uri: connectionUri,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
};

export const db = globalForDb.mysqlPool ?? mysql.createPool(config);
if (process.env.NODE_ENV !== "production") globalForDb.mysqlPool = db;

export async function query<T = unknown>(sql: string, params: unknown[] = []) {
  const [rows] = await db.query(sql, params);
  return rows as T;
}`,
    };
  }

  if (kind === "mongodb") {
    return {
      file: "app/lib/db.ts",
      install: "npm install mongodb",
      code: `"use server";
import { MongoClient } from "mongodb";

const uri = process.env.${envVar};
if (!uri) throw new Error("Missing ${envVar}");

const globalForDb = globalThis as unknown as {
  mongoClientPromise?: Promise<MongoClient>;
};

const clientPromise =
  globalForDb.mongoClientPromise ??
  new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 5_000 }).connect();

if (process.env.NODE_ENV !== "production") {
  globalForDb.mongoClientPromise = clientPromise;
}

export async function getDb(name = "app") {
  const client = await clientPromise;
  return client.db(name);
}`,
    };
  }

  return {
    file: "app/lib/redis.ts",
    install: "npm install ioredis",
    code: `"use server";
import Redis from "ioredis";

const redisUrl = process.env.${envVar};
if (!redisUrl) throw new Error("Missing ${envVar}");

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: false,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export async function healthcheck() {
  return redis.ping();
}`,
  };
}

function buildNodeGuide(kind: DatabaseKind, envVar: string): StackGuide {
  if (kind === "postgres") {
    return {
      file: "src/db.ts",
      install: "npm install pg",
      code: `import { Pool } from "pg";

const connectionString = process.env.${envVar};
if (!connectionString) throw new Error("Missing ${envVar}");

export const db = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
});

export async function query<T = unknown>(text: string, params: unknown[] = []) {
  const result = await db.query<T>(text, params);
  return result.rows;
}

process.on("SIGTERM", async () => {
  await db.end();
});`,
    };
  }

  if (kind === "mysql") {
    return {
      file: "src/db.ts",
      install: "npm install mysql2",
      code: `import mysql from "mysql2/promise";

const uri = process.env.${envVar};
if (!uri) throw new Error("Missing ${envVar}");

export const db = mysql.createPool({
  uri,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
});

export async function query<T = unknown>(sql: string, params: unknown[] = []) {
  const [rows] = await db.query(sql, params);
  return rows as T;
}`,
    };
  }

  if (kind === "mongodb") {
    return {
      file: "src/db.ts",
      install: "npm install mongodb",
      code: `import { MongoClient } from "mongodb";

const uri = process.env.${envVar};
if (!uri) throw new Error("Missing ${envVar}");

const client = new MongoClient(uri, {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5_000,
});

let connected = false;
export async function getDb(name = "app") {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return client.db(name);
}`,
    };
  }

  return {
    file: "src/redis.ts",
    install: "npm install ioredis",
    code: `import Redis from "ioredis";

const redisUrl = process.env.${envVar};
if (!redisUrl) throw new Error("Missing ${envVar}");

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 2,
  connectTimeout: 5_000,
  enableAutoPipelining: true,
});

export async function cacheGet(key: string) {
  return redis.get(key);
}`,
  };
}

function buildPythonGuide(kind: DatabaseKind, envVar: string): StackGuide {
  if (kind === "postgres") {
    return {
      file: "db.py",
      install: "pip install sqlalchemy psycopg[binary]",
      code: `import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ["${envVar}"]

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    pool_recycle=1800,
)

def healthcheck():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))`,
    };
  }

  if (kind === "mysql") {
    return {
      file: "db.py",
      install: "pip install sqlalchemy pymysql",
      code: `import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ["${envVar}"]

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    pool_recycle=1800,
)

def healthcheck():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))`,
    };
  }

  if (kind === "mongodb") {
    return {
      file: "db.py",
      install: "pip install pymongo",
      code: `import os
from pymongo import MongoClient

MONGODB_URI = os.environ["${envVar}"]

client = MongoClient(
    MONGODB_URI,
    maxPoolSize=10,
    serverSelectionTimeoutMS=5000,
)

def get_db(name="app"):
    return client[name]`,
    };
  }

  return {
    file: "db.py",
    install: "pip install redis",
    code: `import os
import redis

REDIS_URL = os.environ["${envVar}"]
cache = redis.from_url(REDIS_URL, socket_timeout=5, decode_responses=True)

def healthcheck():
    return cache.ping()`,
  };
}

function buildGoGuide(kind: DatabaseKind, envVar: string): StackGuide {
  if (kind === "postgres") {
    return {
      file: "internal/db/db.go",
      install: "go get github.com/jackc/pgx/v5/pgxpool",
      code: `package db

import (
  "context"
  "errors"
  "os"
  "time"
  "github.com/jackc/pgx/v5/pgxpool"
)

func NewPostgresPool() (*pgxpool.Pool, error) {
  dsn := os.Getenv("${envVar}")
  if dsn == "" {
    return nil, errors.New("missing ${envVar}")
  }

  cfg, err := pgxpool.ParseConfig(dsn)
  if err != nil { return nil, err }
  cfg.MaxConns = 10
  cfg.MinConns = 1
  cfg.MaxConnIdleTime = 30 * time.Second

  ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
  defer cancel()
  return pgxpool.NewWithConfig(ctx, cfg)
}`,
    };
  }

  if (kind === "mysql") {
    return {
      file: "internal/db/db.go",
      install: "go get github.com/go-sql-driver/mysql",
      code: `package db

import (
  "context"
  "database/sql"
  "errors"
  "os"
  "time"
  _ "github.com/go-sql-driver/mysql"
)

func NewMySQL() (*sql.DB, error) {
  dsn := os.Getenv("${envVar}")
  if dsn == "" {
    return nil, errors.New("missing ${envVar}")
  }

  db, err := sql.Open("mysql", dsn)
  if err != nil { return nil, err }

  db.SetMaxOpenConns(10)
  db.SetMaxIdleConns(5)
  db.SetConnMaxLifetime(1 * time.Hour)

  ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
  defer cancel()
  if err := db.PingContext(ctx); err != nil {
    _ = db.Close()
    return nil, err
  }
  return db, nil
}`,
    };
  }

  if (kind === "mongodb") {
    return {
      file: "internal/db/db.go",
      install: "go get go.mongodb.org/mongo-driver/mongo",
      code: `package db

import (
  "context"
  "errors"
  "os"
  "time"
  "go.mongodb.org/mongo-driver/mongo"
  "go.mongodb.org/mongo-driver/mongo/options"
  "go.mongodb.org/mongo-driver/mongo/readpref"
)

func NewMongo() (*mongo.Client, error) {
  uri := os.Getenv("${envVar}")
  if uri == "" { return nil, errors.New("missing ${envVar}") }

  ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
  defer cancel()

  client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
  if err != nil { return nil, err }
  if err := client.Ping(ctx, readpref.Primary()); err != nil {
    _ = client.Disconnect(context.Background())
    return nil, err
  }
  return client, nil
}`,
    };
  }

  return {
    file: "internal/cache/redis.go",
    install: "go get github.com/redis/go-redis/v9",
    code: `package cache

import (
  "context"
  "errors"
  "os"
  "time"
  "github.com/redis/go-redis/v9"
)

func NewRedis() (*redis.Client, error) {
  redisURL := os.Getenv("${envVar}")
  if redisURL == "" { return nil, errors.New("missing ${envVar}") }

  opts, err := redis.ParseURL(redisURL)
  if err != nil { return nil, err }

  client := redis.NewClient(opts)
  ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
  defer cancel()
  if err := client.Ping(ctx).Err(); err != nil {
    _ = client.Close()
    return nil, err
  }
  return client, nil
}`,
  };
}

function buildPhpGuide(kind: DatabaseKind, envVar: string): StackGuide {
  if (kind === "mongodb") {
    return {
      file: "app/Infrastructure/MongoClientFactory.php",
      install: "composer require mongodb/mongodb",
      code: `<?php

declare(strict_types=1);

use MongoDB\\Client;

function mongo_client(): Client {
    $uri = $_ENV['${envVar}'] ?? getenv('${envVar}');
    if (!$uri) {
        throw new RuntimeException('Missing ${envVar}');
    }

    return new Client($uri, ['maxPoolSize' => 10]);
}`,
    };
  }

  if (kind === "redis") {
    return {
      file: "app/Infrastructure/RedisFactory.php",
      install: "Install php-redis extension",
      code: `<?php

declare(strict_types=1);

function redis_client(): Redis {
    $redisUrl = $_ENV['${envVar}'] ?? getenv('${envVar}');
    if (!$redisUrl) {
        throw new RuntimeException('Missing ${envVar}');
    }

    $parts = parse_url($redisUrl);
    $redis = new Redis();
    $redis->connect($parts['host'], (int)($parts['port'] ?? 6379), 5.0);
    if (isset($parts['pass'])) {
        $redis->auth($parts['pass']);
    }
    return $redis;
}`,
    };
  }

  return {
    file: "app/Infrastructure/DbConnection.php",
    install: "composer require vlucas/phpdotenv",
    code: `<?php

declare(strict_types=1);

function db_connection(): PDO {
    $dsn = $_ENV['${envVar}'] ?? getenv('${envVar}');
    if (!$dsn) {
        throw new RuntimeException('Missing ${envVar}');
    }

    return new PDO($dsn, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5,
    ]);
}`,
  };
}

function buildJavaGuide(kind: DatabaseKind, envVar: string): StackGuide {
  if (kind === "postgres") {
    return {
      file: "src/main/java/com/example/config/DatabaseConfig.java",
      install: "mvn add dependency:org.postgresql:postgresql && mvn add dependency:com.zaxxer:HikariCP",
      code: `import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;

public final class DatabaseConfig {
  private static final String DATABASE_URL = System.getenv("${envVar}");

  public static DataSource dataSource() {
    if (DATABASE_URL == null || DATABASE_URL.isBlank()) {
      throw new IllegalStateException("Missing ${envVar}");
    }

    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(DATABASE_URL.replace("postgres://", "jdbc:postgresql://"));
    config.setMaximumPoolSize(10);
    config.setConnectionTimeout(5000);
    config.setIdleTimeout(30000);
    return new HikariDataSource(config);
  }
}`,
    };
  }

  if (kind === "mysql") {
    return {
      file: "src/main/java/com/example/config/DatabaseConfig.java",
      install: "mvn add dependency:com.mysql:mysql-connector-j && mvn add dependency:com.zaxxer:HikariCP",
      code: `import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;

public final class DatabaseConfig {
  private static final String DATABASE_URL = System.getenv("${envVar}");

  public static DataSource dataSource() {
    if (DATABASE_URL == null || DATABASE_URL.isBlank()) {
      throw new IllegalStateException("Missing ${envVar}");
    }

    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(DATABASE_URL.replace("mysql://", "jdbc:mysql://"));
    config.setMaximumPoolSize(10);
    config.setConnectionTimeout(5000);
    return new HikariDataSource(config);
  }
}`,
    };
  }

  if (kind === "mongodb") {
    return {
      file: "src/main/java/com/example/config/MongoConfig.java",
      install: "mvn add dependency:org.mongodb:mongodb-driver-sync",
      code: `import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import java.util.concurrent.TimeUnit;

public final class MongoConfig {
  public static MongoClient client() {
    String uri = System.getenv("${envVar}");
    if (uri == null || uri.isBlank()) {
      throw new IllegalStateException("Missing ${envVar}");
    }

    MongoClientSettings settings = MongoClientSettings.builder()
      .applyConnectionString(new ConnectionString(uri))
      .applyToConnectionPoolSettings(pool -> pool.maxSize(10))
      .applyToSocketSettings(socket -> socket.connectTimeout(5, TimeUnit.SECONDS))
      .build();

    return MongoClients.create(settings);
  }
}`,
    };
  }

  return {
    file: "src/main/java/com/example/config/RedisConfig.java",
    install: "mvn add dependency:redis.clients:jedis",
    code: `import redis.clients.jedis.DefaultJedisClientConfig;
import redis.clients.jedis.HostAndPort;
import redis.clients.jedis.JedisPooled;
import redis.clients.jedis.JedisURIHelper;
import java.net.URI;

public final class RedisConfig {
  public static JedisPooled client() {
    String redisUrl = System.getenv("${envVar}");
    if (redisUrl == null || redisUrl.isBlank()) {
      throw new IllegalStateException("Missing ${envVar}");
    }

    URI uri = URI.create(redisUrl);
    HostAndPort address = new HostAndPort(uri.getHost(), uri.getPort());
    DefaultJedisClientConfig cfg = DefaultJedisClientConfig.builder()
      .password(JedisURIHelper.getPassword(uri))
      .timeoutMillis(5000)
      .build();
    return new JedisPooled(address, cfg);
  }
}`,
  };
}

function buildRustGuide(kind: DatabaseKind, envVar: string): StackGuide {
  if (kind === "postgres") {
    return {
      file: "src/db.rs",
      install: "cargo add sqlx --features postgres,runtime-tokio-rustls && cargo add tokio --features full",
      code: `use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use std::env;

pub async fn connect() -> Result<Pool<Postgres>, sqlx::Error> {
    let url = env::var("${envVar}").expect("missing ${envVar}");
    PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&url)
        .await
}`,
    };
  }

  if (kind === "mysql") {
    return {
      file: "src/db.rs",
      install: "cargo add sqlx --features mysql,runtime-tokio-rustls && cargo add tokio --features full",
      code: `use sqlx::{mysql::MySqlPoolOptions, MySqlPool};
use std::env;

pub async fn connect() -> Result<MySqlPool, sqlx::Error> {
    let url = env::var("${envVar}").expect("missing ${envVar}");
    MySqlPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&url)
        .await
}`,
    };
  }

  if (kind === "mongodb") {
    return {
      file: "src/db.rs",
      install: "cargo add mongodb && cargo add tokio --features full",
      code: `use mongodb::{options::ClientOptions, Client};
use std::env;

pub async fn connect() -> mongodb::error::Result<Client> {
    let uri = env::var("${envVar}").expect("missing ${envVar}");
    let mut options = ClientOptions::parse(&uri).await?;
    options.max_pool_size = Some(10);
    options.server_selection_timeout = Some(std::time::Duration::from_secs(5));
    Client::with_options(options)
}`,
    };
  }

  return {
    file: "src/cache.rs",
    install: "cargo add redis --features tokio-comp,aio",
    code: `use redis::{aio::ConnectionManager, Client};
use std::env;

pub async fn connect() -> redis::RedisResult<ConnectionManager> {
    let redis_url = env::var("${envVar}").expect("missing ${envVar}");
    let client = Client::open(redis_url)?;
    client.get_connection_manager().await
}`,
  };
}

function buildStackGuide(stack: StackKey, kind: DatabaseKind, envVar: string): StackGuide {
  if (stack === "nextjs") return buildNextJsGuide(kind, envVar);
  if (stack === "python") return buildPythonGuide(kind, envVar);
  if (stack === "go") return buildGoGuide(kind, envVar);
  if (stack === "php") return buildPhpGuide(kind, envVar);
  if (stack === "java") return buildJavaGuide(kind, envVar);
  if (stack === "rust") return buildRustGuide(kind, envVar);
  return buildNodeGuide(kind, envVar);
}

export function DatabaseConnectionModal({ open, onOpenChange, connectionUri, isActive }: DatabaseConnectionModalProps) {
  const haptics = useHaptics();
  const decryptConnectionUri = useServerFn(decryptDatabaseConnectionUriServerFn as any) as (args: {
    data: { encryptedConnectionUri: string };
  }) => Promise<{ connectionUri: string }>;
  const [uriCopied, setUriCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [decryptedUri, setDecryptedUri] = useState<string>("");
  const [decryptingUri, setDecryptingUri] = useState(false);
  const [selectedStack, setSelectedStack] = useState<StackKey>("nextjs");
  const [guideTab, setGuideTab] = useState<"code" | "env">("code");
  const [installCopied, setInstallCopied] = useState(false);
  const [guideCopied, setGuideCopied] = useState(false);

  const parsed = decryptedUri ? parseConnectionUri(decryptedUri) : null;
  const dbKind = parsed ? resolveDatabaseKind(parsed.protocol) : null;
  const envVar = dbKind ? connectionEnvVar(dbKind) : "DATABASE_URL";
  const activeGuide = useMemo(() => {
    if (!dbKind) return null;
    return buildStackGuide(selectedStack, dbKind, envVar);
  }, [dbKind, envVar, selectedStack]);
  const envSnippetValue = useMemo(() => {
    if (!parsed) return "";
    return buildParamsText(parsed, showPassword);
  }, [parsed, showPassword]);
  const guideSnippet = guideTab === "env" ? envSnippetValue : activeGuide?.code || "Snippet unavailable.";

  const ensureDecrypted = useCallback(async (): Promise<string> => {
    if (!connectionUri) {
      throw new Error("Connection URI not available yet.");
    }

    if (decryptedUri) {
      return decryptedUri;
    }

    setDecryptingUri(true);
    try {
      const result = await decryptConnectionUri({
        data: { encryptedConnectionUri: connectionUri },
      });
      const nextValue = result?.connectionUri?.trim();
      if (!nextValue) {
        throw new Error("Failed to decrypt database connection URI");
      }
      setDecryptedUri(nextValue);
      return nextValue;
    } finally {
      setDecryptingUri(false);
    }
  }, [connectionUri, decryptConnectionUri, decryptedUri]);

  useEffect(() => {
    if (!open || !isActive || !connectionUri || decryptedUri || decryptingUri) {
      return;
    }

    void ensureDecrypted().catch(() => {
      // Keep modal usable even if decryption fails; copy/reveal handlers show user-facing errors.
    });
  }, [connectionUri, decryptedUri, decryptingUri, ensureDecrypted, isActive, open]);

  useEffect(() => {
    setDecryptedUri("");
    setRevealed(false);
    setShowPassword(false);
  }, [connectionUri]);

  useEffect(() => {
    if (!open) {
      setUriCopied(false);
      setInstallCopied(false);
      setGuideCopied(false);
      setGuideTab("code");
      setSelectedStack("nextjs");
    }
  }, [open]);

  async function handleRevealToggle() {
    if (decryptingUri) return;

    if (revealed) {
      setRevealed(false);
      return;
    }

    try {
      await ensureDecrypted();
      setRevealed(true);
    } catch {
      toast.error("Unable to reveal connection details", {
        description: "Something went wrong while retrieving your credentials. Please try again or contact support if the issue persists.",
      });
    }
  }

  async function handleCopyUri() {
    if (!connectionUri || decryptingUri) return;

    try {
      const decrypted = await ensureDecrypted();
      await navigator.clipboard.writeText(decrypted);
      haptics.light();
      setUriCopied(true);
      setTimeout(() => setUriCopied(false), 1500);
      toast.success("Connection URI copied");
    } catch (error: any) {
      toast.error("Failed to copy connection URI", {
        description: typeof error?.message === "string" ? error.message : "Please try again.",
      });
    }
  }

  async function handleCopyGuide() {
    if (!connectionUri || decryptingUri) return;

    try {
      const decrypted = await ensureDecrypted();
      const p = parseConnectionUri(decrypted);
      if (!p) {
        toast.error("Could not build connection guide");
        return;
      }

      const kind = resolveDatabaseKind(p.protocol);
      const nextEnvVar = connectionEnvVar(kind);
      const guide = buildStackGuide(selectedStack, kind, nextEnvVar);
      const value = guideTab === "env" ? buildCopyableParams(p) : guide.code;

      await navigator.clipboard.writeText(value);
      haptics.light();
      setGuideCopied(true);
      setTimeout(() => setGuideCopied(false), 1500);
      toast.success(guideTab === "env" ? "Environment value copied" : "Code snippet copied");
    } catch (error: any) {
      toast.error("Failed to copy snippet", {
        description: typeof error?.message === "string" ? error.message : "Please try again.",
      });
    }
  }

  async function handleCopyInstall() {
    const value = activeGuide?.install?.trim();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      haptics.light();
      setInstallCopied(true);
      setTimeout(() => setInstallCopied(false), 1500);
      toast.success("Install command copied");
    } catch {
      toast.error("Failed to copy install command");
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={700}>
      <ModalHeader title="Database Connection" description="Copy your connection details below." />

      <div className="flex flex-col gap-5 px-6 py-5">
        {!isActive && <p className="text-xs text-dash-text-faded">Connection details are available when the database is active.</p>}

        {/* Full URI */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.08em] text-dash-text-faded">Connection URI</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  void handleRevealToggle();
                }}
                disabled={!connectionUri || decryptingUri}
                className="flex items-center gap-1 text-xs text-dash-text-faded transition-colors hover:text-dash-text-strong disabled:opacity-40"
              >
                {decryptingUri ? (
                  <span className="inline-block size-3 animate-spin rounded-full border border-current border-t-transparent" />
                ) : revealed ? (
                  <EyeOff className="size-3" />
                ) : (
                  <Eye className="size-3" />
                )}
                <span>{decryptingUri ? "Preparing connection details..." : revealed ? "Hide" : "Reveal"}</span>
              </button>
              <button
                onClick={() => {
                  void handleCopyUri();
                }}
                disabled={!connectionUri || decryptingUri}
                className="flex items-center gap-1 text-xs text-dash-text-faded transition-colors hover:text-dash-text-strong disabled:opacity-40"
              >
                {uriCopied ? <Check className="size-3 text-[#13d282]" /> : <Copy className="size-3" />}
                <span>{uriCopied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-[6px] bg-[#222528]">
            {decryptingUri && !decryptedUri ? (
              <div className="space-y-2 px-4 py-3">
                <div className="h-3 w-full animate-pulse rounded bg-white/10" />
                <div className="h-3 w-[85%] animate-pulse rounded bg-white/10" />
                <div className="h-3 w-[60%] animate-pulse rounded bg-white/10" />
              </div>
            ) : (
              <code className="block break-all px-4 py-3 font-mono text-[12px] leading-5 text-[#e8eaed]">
                {!connectionUri
                  ? "Connection URI not available yet."
                  : revealed && decryptedUri
                    ? decryptedUri
                    : maskSecretWithAsterisks(connectionUri)}
              </code>
            )}
          </div>
        </div>

        {decryptingUri && !parsed && <ConnectionGuideSkeleton />}

        {parsed && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs uppercase tracking-[0.08em] text-dash-text-faded">Connection Guide</span>
                <div className="w-full sm:w-[240px]">
                  <Dropdown
                    value={selectedStack}
                    options={STACK_OPTIONS}
                    onChange={(value) => {
                      setSelectedStack(value as StackKey);
                      setGuideCopied(false);
                    }}
                  />
                </div>
              </div>

              <div className="mt-1 mb-1.5 flex items-center justify-between gap-3 px-0.5 py-2 text-xs text-dash-text-faded">
                <div className="min-w-0">
                  <span className="font-medium text-dash-text-body">Install:</span>{" "}
                  <code className="font-mono text-[11px] text-dash-text-body">{activeGuide?.install}</code>
                  {activeGuide?.file ? (
                    <>
                      {" "}
                      <span className="text-dash-text-extra-faded">|</span> <span className="font-medium text-dash-text-body">File:</span>{" "}
                      <code className="font-mono text-[11px] text-dash-text-body">{activeGuide.file}</code>
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyInstall();
                  }}
                  className="shrink-0 text-dash-text-faded transition-colors hover:text-dash-text-strong"
                  aria-label="Copy install command"
                >
                  {installCopied ? <Check className="size-3.5 text-[#13d282]" /> : <Copy className="size-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 rounded-[4px] border-[0.5px] border-dash-border p-0.5">
                  <button
                    type="button"
                    onClick={() => setGuideTab("code")}
                    className={`rounded-[3px] px-2.5 py-1 text-xs font-medium transition-colors ${
                      guideTab === "code" ? "bg-dash-bg-elevated text-dash-text-strong" : "text-dash-text-faded hover:text-dash-text-body"
                    }`}
                  >
                    {activeGuide?.file || "Code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideTab("env")}
                    className={`rounded-[3px] px-2.5 py-1 text-xs font-medium transition-colors ${
                      guideTab === "env" ? "bg-dash-bg-elevated text-dash-text-strong" : "text-dash-text-faded hover:text-dash-text-body"
                    }`}
                  >
                    .env
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {guideTab === "env" && (
                    <button
                      onClick={() => setShowPassword((v) => !v)}
                      className="flex items-center gap-1 text-xs text-dash-text-faded transition-colors hover:text-dash-text-strong"
                    >
                      {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                      <span>{showPassword ? "Hide password" : "Reveal password"}</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      void handleCopyGuide();
                    }}
                    className="flex items-center gap-1 text-xs text-dash-text-faded transition-colors hover:text-dash-text-strong"
                  >
                    {guideCopied ? <Check className="size-3 text-[#13d282]" /> : <Copy className="size-3" />}
                    <span>{guideCopied ? "Copied" : "Copy snippet"}</span>
                  </button>
                </div>
              </div>

              <motion.div
                layout
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden rounded-[6px] bg-[#222528]"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.pre
                    key={`${guideTab}:${selectedStack}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="m-0 max-h-[240px] overflow-auto overscroll-contain whitespace-pre px-4 py-3 font-mono text-[12px] leading-5 text-[#e8eaed] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.14)_transparent] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent"
                  >
                    <code>
                      {highlight(guideSnippet).map((tok, i) => (
                        <Fragment key={i}>{tok.cls ? <span className={tok.cls}>{tok.text}</span> : tok.text}</Fragment>
                      ))}
                    </code>
                  </motion.pre>
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        <ModalCancelButton />
        <span />
      </ModalFooter>
    </Modal>
  );
}

function ConnectionGuideSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="h-3 w-32 animate-pulse rounded bg-dash-border-soft" />
        <div className="h-9 w-[240px] animate-pulse rounded-[4px] bg-dash-border-soft" />
      </div>

      <div className="flex items-center justify-between">
        <div className="h-3 w-56 animate-pulse rounded bg-dash-border-soft" />
        <div className="h-3.5 w-3.5 animate-pulse rounded bg-dash-border-soft" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-[4px] border-[0.5px] border-dash-border p-0.5">
          <div className="h-6 w-20 animate-pulse rounded-[3px] bg-dash-border-soft" />
          <div className="h-6 w-12 animate-pulse rounded-[3px] bg-dash-border-soft" />
        </div>
        <div className="h-3 w-20 animate-pulse rounded bg-dash-border-soft" />
      </div>

      <div className="overflow-hidden rounded-[6px] bg-[#222528] p-4">
        <div className="space-y-2">
          {[100, 80, 92, 70, 86, 60, 95, 75].map((w, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-white/10" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
