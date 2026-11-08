// 22 bits per horizontal chunk coordinate cover the entire Java world border;
// eight vertical bits cover every native 1.17 section, including light borders.
// The result fits exactly in a JavaScript Number (52 bits).
export const sectionKey=(x,y,z)=>((x+0x200000)*0x400000+(z+0x200000))*256+y+128;
export function sectionCoords(key){const column=Math.floor(key/256);return[Math.floor(column/0x400000)-0x200000,key%256-128,column%0x400000-0x200000];}
