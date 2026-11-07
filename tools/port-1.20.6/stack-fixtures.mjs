import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { prepare, cache, target } from "./prepare.mjs";

const fixtureUrl = new URL("./stack-fixtures.json", import.meta.url);
const oracleJar = join(cache, "server-component-oracle.jar");
const oracleDir = join(cache, "stack-oracle");
const unpackDir = join(cache, "stack-oracle-server");

const javaSource = `import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import java.util.HexFormat;
import java.util.List;

public class StackOracle {
    static byte[] encode(cur stack) {
        ByteBuf raw = Unpooled.buffer();
        xa buf = new xa(raw, jw.a(lp.aw));
        cur.h.encode(buf, stack);
        byte[] out = new byte[raw.readableBytes()];
        raw.getBytes(raw.readerIndex(), out);
        raw.release();
        return out;
    }

    static void emit(String name, cur stack) {
        System.out.println("STACK " + name + " " + HexFormat.of().formatHex(encode(stack)));
    }

    public static void main(String[] args) throws Exception {
        aa.a();
        alh.a();

        emit("empty", cur.l);
        emit("stone", new cur(cuu.b, 1));

        cur sword = new cur(cuu.pf, 1);
        sword.b(37);
        emit("damaged_sword", sword);

        cur named = new cur(cuu.pf, 1);
        named.b(37);
        named.b(km.g, xp.b("Parity Blade"));
        named.c(km.j);
        emit("named_removed_sword", named);

        cur removedDefault = new cur(cuu.b, 1);
        removedDefault.c(km.c);
        emit("stone_remove_max_stack", removedDefault);

        cur nestedSword = new cur(cuu.pf, 1);
        nestedSword.b(5);
        cur bundle = new cur(cuu.qU, 1);
        bundle.b(km.F, new cxe(List.of(nestedSword)));
        emit("bundle_nested", bundle);
    }
}
`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...options
  });
  if (result.status !== 0) {
    throw new Error(command + " failed: " + (result.stderr || result.stdout || "exit " + result.status));
  }
  return result;
}

async function jarsUnder(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await jarsUnder(path));
    else if (entry.isFile() && entry.name.endsWith(".jar")) out.push(path);
  }
  return out;
}

async function unsignedServerJar() {
  try {
    await readFile(oracleJar);
    return oracleJar;
  } catch {}
  await rm(unpackDir, { recursive: true, force: true });
  await mkdir(unpackDir, { recursive: true });
  run(process.env.JAR || "jar", [
    "xf",
    resolve(join(cache, "bundler", "META-INF", "versions", "1.20.6", "server-1.20.6.jar"))
  ], { cwd: unpackDir });
  const meta = join(unpackDir, "META-INF");
  try {
    for (const entry of await readdir(meta)) {
      if (/\.(?:SF|RSA|DSA|EC)$/i.test(entry)) await unlink(join(meta, entry));
    }
  } catch {}
  run(process.env.JAR || "jar", ["cf", resolve(oracleJar), "-C", resolve(unpackDir), "."]);
  await rm(unpackDir, { recursive: true, force: true });
  return oracleJar;
}

export async function stackFixtures(check = false) {
  await prepare();
  await rm(oracleDir, { recursive: true, force: true });
  await mkdir(oracleDir, { recursive: true });
  await writeFile(join(oracleDir, "StackOracle.java"), javaSource);

  const server = await unsignedServerJar();
  const libraries = await jarsUnder(join(cache, "libraries"));
  const classpath = [server, ...libraries].map((path) => resolve(path)).join(delimiter);
  run(process.env.JAVAC || "javac", [
    "-cp",
    classpath,
    "-d",
    resolve(oracleDir),
    resolve(join(oracleDir, "StackOracle.java"))
  ]);

  const result = run(process.env.JAVA || "java", [
    "-cp",
    classpath + delimiter + resolve(oracleDir),
    "StackOracle"
  ]);
  const fixtures = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/(?:\[STDOUT\]: )?STACK ([a-z0-9_]+) ([0-9a-f]+)$/);
    if (match) fixtures[match[1]] = match[2];
  }

  assert.deepEqual(Object.keys(fixtures), [
    "empty",
    "stone",
    "damaged_sword",
    "named_removed_sword",
    "stone_remove_max_stack",
    "bundle_nested"
  ]);

  const output = {
    minecraftVersion: target.minecraftVersion,
    protocol: target.protocol,
    clientSha1: target.downloads.client.sha1,
    serverSha1: target.downloads.server.sha1,
    fixtures
  };

  if (check) {
    assert.deepEqual(output, JSON.parse(await readFile(fixtureUrl, "utf8")), "Native 1.20.6 stack fixtures differ");
    console.log("Verified " + Object.keys(fixtures).length + " native ItemStack fixtures");
  } else {
    await writeFile(fixtureUrl, JSON.stringify(output, null, 2) + "\n");
    console.log("Recorded " + Object.keys(fixtures).length + " native ItemStack fixtures");
  }
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await stackFixtures(process.argv.includes("--check"));
}
