// Exact Options.getBackgroundColor(float): the accessibility value replaces
// the caller's opacity when text backgrounds apply everywhere.
export function textBackgroundColor(settings,opacity){
 const value=settings.textBackgroundOnlyChat===false?settings.textBackgroundOpacity??.5:opacity;
 return (Math.trunc(Math.fround(Math.fround(value)*255))<<24)>>>0;
}
