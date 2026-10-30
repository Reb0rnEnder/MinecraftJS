// Native 1.17.1 DimensionType codec limits; maxY/maxSection are exclusive.
export function verticalBounds(data={}){
 const minY=data.min_y??0,height=data.height??256,logicalHeight=data.logical_height??height;
 if(!Number.isInteger(minY)||!Number.isInteger(height)||minY%16||height%16||minY< -2032||minY>2031||height<16||height>4064||minY+height>2032||!Number.isInteger(logicalHeight)||logicalHeight<0||logicalHeight>height)throw Error('Invalid dimension vertical bounds');
 return {minY,height,maxY:minY+height,minSection:minY/16,maxSection:(minY+height)/16,sectionCount:height/16,logicalHeight};
}
