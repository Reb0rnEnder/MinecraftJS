import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../../',import.meta.url),data=name=>new URL('client/data/'+name+'.json',root);
const creative=JSON.parse(await readFile(data('creative'),'utf8'));
const items=JSON.parse(await readFile(data('items'),'utf8'));
const search=creative.tabs.find(tab=>tab.label==='search');
if(!search)throw new Error('Search creative tab is missing');
// The inherited 1.14.4 creative dump uses the old item registry.  1.15.2
// inserts the bee spawn egg at 698, shifting the old 698..877 range by one;
// remap every inherited tab before adding the new native-only entries.
if(!creative.source?.itemRegistryRemapped){
  for(const tab of creative.tabs)for(const stack of tab.items)if(stack[0]>=698&&stack[0]<=877)stack[0]++;
  creative.source={...(creative.source||{}),itemRegistryRemapped:true};
}
const present=new Set(search.items.map(stack=>stack[0]));
for(const item of items)if(!present.has(item.id))search.items.push([item.id,0,null]);
creative.version='1.15.2';creative.protocol=578;creative.dataVersion=2230;
creative.source={...(creative.source||{}),version:'1.15.2',protocol:578};
await writeFile(data('creative'),JSON.stringify(creative)+'\n');
console.log(`Updated creative search with ${search.items.length} entries for 1.15.2`);
