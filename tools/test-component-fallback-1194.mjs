import {test} from 'node:test';import assert from 'node:assert/strict';
import {chatToPlain,chatToLegacy,chatSegments,chatComponentString,setTranslator} from '../client/js/gui/chat.js';
import {formatComponentTranslation,componentTemplate} from '../client/js/gui/component-translation.js';
const language={'death.attack.player':'%1$s was slain by %2$s',known:'Localized %s',same:'same'};
setTranslator(k=>language[k]??k,(key,fallback)=>language[key]??fallback??key);
test('unknown server translation IDs use fallback inside death messages',()=>{
 const c={translate:'death.attack.player',with:[{text:'Player'},{translate:'<chat=12345678-1234-4234-8234-123456789abc>',fallback:'Zombie',color:'red'}]};
 assert.equal(chatToPlain(c),'Player was slain by Zombie');assert.equal(chatComponentString(c),'Player was slain by Zombie');assert.ok(chatToLegacy(c).includes('§cZombie'));assert.ok(!chatToPlain(c).includes('<chat='));
});
test('known language keys win; absent and empty fallbacks preserve native behavior',()=>{
 assert.equal(chatToPlain({translate:'known',fallback:'Other %s',with:['text']}),'Localized text');
 assert.equal(chatToPlain({translate:'same',fallback:'wrong'}),'same');
 assert.equal(chatToPlain({translate:'unknown'}),'unknown');assert.equal(chatToPlain({translate:'unknown',fallback:''}),'');
 assert.equal(chatToPlain({text:'literal <chat=uuid>'}),'literal <chat=uuid>');
});
test('fallback argument segments retain their hover and click events',()=>{
 const hover={action:'show_text',contents:{text:'Description'}},c={translate:'unknown',fallback:'Inspect %s!',with:[{text:'Sword',hoverEvent:hover,clickEvent:{action:'suggest_command',value:'/help'}}]};
 assert.equal(chatToPlain(c),'Inspect Sword!');const segments=chatSegments(c);assert.equal(segments.find(s=>s.text.includes('Sword')).hover,hover);assert.equal(segments.find(s=>s.text.includes('Sword')).hoverText,'Description');
});
test('native component formatting supports positional arguments and preserves malformed templates',()=>{
 assert.equal(formatComponentTranslation('%2$s / %s / %%',['A','B']),'B / A / %');
 for(const template of['%d','missing %2$s','invalid %0$s','trailing %','bad %10','bad %1$%'])assert.equal(formatComponentTranslation(template,['A']),template);
 assert.equal(formatComponentTranslation('%s',[null]),'null');
});

test('native language normalization applies to language entries but not server fallback templates',()=>{
 assert.equal(componentTemplate({numeric:'%1$03d / %.2f'},'numeric','other'),'%1$s / %s');
 assert.equal(componentTemplate({},'absent','%d'),'%d');
});

test('literal plugin markers in combat messages stay literal, while item components in broadcast messages render',()=>{
 const marker='<chat=11111111-2222-3333-4444-555555555555:[item]:>',combat={color:'gray',text:'Player was killed by Opponent using '+marker+'.'};
 assert.equal(chatToPlain(combat),combat.text);
 const broadcast={text:'Player was killed by Opponent using ',extra:[{text:'[Dirt x64]',hoverEvent:{action:'show_item',contents:{id:'minecraft:dirt',count:64}}},{text:'.'}]};
 assert.equal(chatToPlain(broadcast),'Player was killed by Opponent using [Dirt x64].');assert.equal(chatSegments(broadcast).find(s=>s.text.includes('Dirt')).hover.contents.id,'minecraft:dirt');
});
