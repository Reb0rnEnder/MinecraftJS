// Native HumanoidModel arm pose and PlayerItemInHandLayer head attachment.
export const spyglassArmPitch = (headPitch, crouching) => Math.max(-2.4, Math.min(3.3, headPitch - 1.9198622 - (crouching ? .2617994 : 0)));
export function attachSpyglassHolder(holder, head, active) {
  if (!holder.armParent) holder.armParent = holder.parent;
  if (active && head?.obj?.parent) {
    head.obj.parent.add(holder);
    holder.position.set(head.px, head.py, head.pz);
    holder.rotation.set(Math.max(-.5235988, Math.min(1.5707964, head.rx)), head.ry, head.rz, 'ZYX');
  } else {
    if (holder.armParent && holder.parent !== holder.armParent) holder.armParent.add(holder);
    holder.position.set(0, 0, 0);holder.rotation.set(0, 0, 0, 'XYZ');
  }
}
