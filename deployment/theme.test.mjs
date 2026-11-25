import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script = readFileSync(new URL('./theme-script.txt', import.meta.url), 'utf8');
function browser({dark = false, blocked = false, saved} = {}) {
 const events = {}, listeners = {}, stored = new Map(saved ? [['reader_theme', saved]] : []);
 const media = {matches:dark,addEventListener:(name, callback) => {listeners[name] = callback;}};
 const pickers = [0,1].map(() => ({value:'',addEventListener(name, callback) {this[name] = callback;}}));
 const meta = {}, root = {dataset:{}};
 let cookie = '';
 const document = {readyState:'complete',documentElement:root,querySelector:() => meta,querySelectorAll:() => pickers};
 Object.defineProperty(document,'cookie',{get:() => cookie,set:value => {cookie = value.split(';')[0];}});
 const window = {matchMedia:() => media,addEventListener:(name, callback) => {events[name] = callback;}};
 vm.runInNewContext(script, {document,window,location:{hostname:'login.anastasiay.ipv64.net'},localStorage:{getItem:key => {if(blocked) throw new Error(); return stored.get(key);},setItem:(key,value) => {if(blocked) throw new Error(); stored.set(key,value);}}});
 return {root,meta,pickers,media,stored,events,listeners,setCookie:value => {cookie = value;},getCookie:() => cookie};
}
test('appearance follows system, persists explicit choices and synchronizes language pickers', () => {
 const b = browser({dark:true});
 assert.equal(b.root.dataset.theme,'dark');
 b.pickers[0].value='light'; b.pickers[0].change();
 assert.equal(b.root.dataset.theme,'light');
 assert.equal(b.pickers[1].value,'light');
 assert.equal(b.stored.get('reader_theme'),'light');
 assert.equal(b.getCookie(),'reader_theme=light');
 b.listeners.change(); assert.equal(b.root.dataset.theme,'light');
 b.pickers[1].value='system'; b.pickers[1].change();
 b.media.matches=false; b.listeners.change();
 assert.equal(b.root.dataset.theme,'light');
 b.media.matches=true; b.listeners.change();
 assert.equal(b.root.dataset.theme,'dark');
 b.setCookie('reader_theme=light'); b.events.focus();
 assert.equal(b.root.dataset.theme,'light','pick up a preference changed on the other subdomain');
 assert.equal(b.meta.content,'#f5f5f7');
});
test('appearance remains usable without storage and ignores invalid saved settings', () => {
 const b = browser({blocked:true});
 b.pickers[0].value='dark'; b.pickers[0].change();
 assert.equal(b.root.dataset.theme,'dark');
 assert.equal(browser({saved:'invalid',dark:true}).root.dataset.theme,'dark');
 assert.equal(browser({saved:'light',dark:true}).root.dataset.theme,'light');
});
