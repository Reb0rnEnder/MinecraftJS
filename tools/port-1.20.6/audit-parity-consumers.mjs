// Read-only diagnostic, not a passing regression gate or full gameplay acceptance.
import{readFile}from'node:fs/promises';
import{Items}from'../../client/js/game/items.js';import{Reader766}from'../../client/js/net/configuration-1.20.6.js';
const json=async p=>JSON.parse(await readFile(new URL(p,import.meta.url)));
const fixtures=await json('./stack-fixtures.json'),items=new Items({data:{items:await json('../../client/data/items.json'),creative:await json('../../client/data/creative.json')}});
const damaged=new Reader766(Buffer.from(fixtures.fixtures.damaged_sword,'hex')).slot(),named=new Reader766(Buffer.from(fixtures.fixtures.named_removed_sword,'hex')).slot();
console.log(JSON.stringify({target:fixtures.minecraftVersion,nativeFixtureClientSha1:fixtures.clientSha1,diagnosticOnly:true,damage:{native:damaged.damage,currentItemConsumer:items.damage(damaged),matches:items.damage(damaged)===damaged.damage},customName:{native:named.componentValues.custom_name,currentItemConsumer:items.displayName(named),note:'Consumers read effective components directly; absence of a legacy NBT view is expected.'}},null,2));
