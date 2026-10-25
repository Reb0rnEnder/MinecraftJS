import {test} from 'node:test';import assert from 'node:assert/strict';
import {C} from '../client/js/net/packets.js';import {Reader} from '../client/js/net/buffer.js';
import {nbt} from '../client/js/net/nbt.js';
test('book save uses the protocol-404 edit-book packet and preserves off-hand selection and page NBT',()=>{
 const item={id:759,count:1,nbt:{t:10,name:'',v:{pages:nbt.list(8,['backported save'])}}},r=new Reader(C.editBook(item,true,1));
 assert.equal(r.varint(),11);assert.equal(r.slot().id,item.id);assert.equal(r.bool(),true);assert.equal(r.varint(),1);assert.equal(r.remaining(),0);
});
test('technical editors use native command packets, packed positions, enums and flags',()=>{
 const p={x:-11,y:64,z:17},r=new Reader(C.updateCommandBlock(p,'say native','AUTO',true,true,true));assert.equal(r.varint(),34);assert.deepEqual(r.position(),p);assert.equal(r.string(),'say native');assert.equal(r.varint(),1);assert.equal(r.u8(),7);assert.equal(r.remaining(),0);
 const m=new Reader(C.updateCommandMinecart(300,'say cart',false));assert.equal(m.varint(),35);assert.equal(m.varint(),300);assert.equal(m.string(),'say cart');assert.equal(m.bool(),false);assert.equal(m.remaining(),0);
});

test('anvil rename and beacon selection use their dedicated protocol-404 packets',()=>{
 assert.equal(Buffer.from(C.nameItem('Test')).toString('hex'),'1c0454657374');assert.equal(Buffer.from(C.setBeaconEffects(1,10)).toString('hex'),'20010a');
});
