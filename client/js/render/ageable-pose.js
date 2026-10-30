// AgeableListModel.renderToBuffer, with pivots expressed in model pixels.
export function scaleAgeableGroups(groups, child, options) {
 const headScale=child?(options.scaleHead?1.5/options.headScale:1):1,bodyScale=child?1/options.bodyScale:1;
 groups.head.scale.setScalar(headScale);groups.head.position.set(0,child?options.headY*headScale:0,child?options.headZ*headScale:0);
 groups.body.scale.setScalar(bodyScale);groups.body.position.set(0,child?options.bodyY*bodyScale:0,0);
}
