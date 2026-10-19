import net.minecraft.init.Bootstrap;
import net.minecraft.creativetab.CreativeTabs;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.nbt.*;
import net.minecraft.util.NonNullList;
import net.minecraft.util.ResourceLocation;
import net.minecraft.potion.Potion;
import net.minecraft.potion.PotionEffect;
import net.minecraft.potion.PotionType;
import net.minecraft.entity.EntityList;
import net.minecraft.entity.ai.attributes.*;
import java.util.Map;
import java.io.*;
import java.nio.charset.StandardCharsets;

// Writes client/data/creative.json: the 1.12.2 creative tabs (CreativeTabs.displayAllRelevantItems), potion types,
// potion effects and spawn eggs, read from the game itself. Needs Java 11+ (single-file source launch), an MCP-named
// client jar and the server jar for its libraries:
//   java -cp mapped-client.jar:server.jar tools/creative-dump/Dump.java client/data/creative.json
// (the output is then reformatted one tab per line).
public class Dump {
  static String q(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }

  // typed NBT like client/js/net/nbt.js: compound { key: { t, v } }, list { et, items }
  static String payload(NBTBase t) {
    switch (t.getId()) {
      case 1: return Byte.toString(((NBTTagByte) t).getByte());
      case 2: return Short.toString(((NBTTagShort) t).getShort());
      case 3: return Integer.toString(((NBTTagInt) t).getInt());
      case 4: return q(Long.toString(((NBTTagLong) t).getLong()));
      case 5: return Float.toString(((NBTTagFloat) t).getFloat());
      case 6: return Double.toString(((NBTTagDouble) t).getDouble());
      case 7: { StringBuilder b = new StringBuilder("["); byte[] a = ((NBTTagByteArray) t).getByteArray(); for (int i = 0; i < a.length; i++) b.append(i > 0 ? "," : "").append(a[i]); return b.append("]").toString(); }
      case 8: return q(((NBTTagString) t).getString());
      case 9: {
        NBTTagList l = (NBTTagList) t;
        StringBuilder b = new StringBuilder("{\"et\":" + (l.tagCount() == 0 ? 0 : l.getTagType()) + ",\"items\":[");
        for (int i = 0; i < l.tagCount(); i++) b.append(i > 0 ? "," : "").append(payload(l.get(i)));
        return b.append("]}").toString();
      }
      case 10: {
        NBTTagCompound c = (NBTTagCompound) t;
        StringBuilder b = new StringBuilder("{");
        boolean first = true;
        for (String k : c.getKeySet()) {
          NBTBase v = c.getTag(k);
          b.append(first ? "" : ",").append(q(k)).append(":{\"t\":").append(v.getId()).append(",\"v\":").append(payload(v)).append("}");
          first = false;
        }
        return b.append("}").toString();
      }
      case 11: { StringBuilder b = new StringBuilder("["); int[] a = ((NBTTagIntArray) t).getIntArray(); for (int i = 0; i < a.length; i++) b.append(i > 0 ? "," : "").append(a[i]); return b.append("]").toString(); }
      default: return "null";
    }
  }

  static String stack(ItemStack s) {
    String nbt = s.hasTagCompound() ? payload(s.getTagCompound()) : "null";
    return "[" + Item.getIdFromItem(s.getItem()) + "," + s.getMetadata() + "," + nbt + "]";
  }

  public static void main(String[] args) throws Exception {
    Bootstrap.register();
    StringBuilder o = new StringBuilder("{\n\"tabs\":[\n");
    boolean first = true;
    for (CreativeTabs t : CreativeTabs.CREATIVE_TAB_ARRAY) {
      if (t == null) continue;
      NonNullList<ItemStack> list = NonNullList.create();
      if (t == CreativeTabs.SEARCH) { for (Item it : Item.REGISTRY) it.getSubItems(t, list); } // SearchTreeManager.ITEMS
      else if (t != CreativeTabs.HOTBAR && t != CreativeTabs.INVENTORY) t.displayAllRelevantItems(list);
      o.append(first ? "" : ",\n").append("{\"index\":").append(t.getIndex()).append(",\"label\":").append(q(t.getTabLabel()))
        .append(",\"icon\":").append(stack(t.getIcon()))
        .append(",\"background\":").append(q(t.getBackgroundImageName())).append(",\"title\":").append(t.drawInForegroundOfTab())
        .append(",\"scrollbar\":").append(t.hasScrollbar()).append(",\"column\":").append(t.getColumn()).append(",\"top\":").append(t.isOnTopRow())
        .append(",\"right\":").append(t.isAlignedRight()).append(",\"items\":[");
      for (int i = 0; i < list.size(); i++) o.append(i > 0 ? "," : "").append(stack(list.get(i)));
      o.append("]}");
      first = false;
    }
    o.append("\n],\n\"potions\":{");
    first = true;
    for (ResourceLocation k : PotionType.REGISTRY.getKeys()) {
      PotionType p = PotionType.REGISTRY.getObject(k);
      o.append(first ? "\n" : ",\n").append(q(k.toString())).append(":{\"id\":").append(PotionType.REGISTRY.getIDForObject(p))
        .append(",\"name\":").append(q(p.getNamePrefixed(""))).append(",\"effects\":[");
      boolean f2 = true;
      for (PotionEffect e : p.getEffects()) {
        o.append(f2 ? "" : ",").append("[").append(Potion.getIdFromPotion(e.getPotion())).append(",").append(e.getDuration()).append(",").append(e.getAmplifier()).append("]");
        f2 = false;
      }
      o.append("]}");
      first = false;
    }
    o.append("\n},\n\"effects\":{");
    first = true;
    for (ResourceLocation k : Potion.REGISTRY.getKeys()) {
      Potion p = Potion.REGISTRY.getObject(k);
      o.append(first ? "\n" : ",\n").append(q(String.valueOf(Potion.getIdFromPotion(p)))).append(":{\"key\":").append(q(k.toString())).append(",\"name\":").append(q(p.getName()))
        .append(",\"color\":").append(p.getLiquidColor()).append(",\"bad\":").append(p.isBadEffect()).append(",\"modifiers\":[");
      boolean f2 = true;
      for (Map.Entry<IAttribute, AttributeModifier> m : p.getAttributeModifierMap().entrySet()) {
        o.append(f2 ? "" : ",").append("[").append(q(m.getKey().getName())).append(",").append(p.getAttributeModifierAmount(0, m.getValue())).append(",").append(m.getValue().getOperation()).append("]");
        f2 = false;
      }
      o.append("]}");
      first = false;
    }
    o.append("\n},\n\"eggs\":{");
    first = true;
    for (EntityList.EntityEggInfo e : EntityList.ENTITY_EGGS.values()) {
      o.append(first ? "\n" : ",\n").append(q(e.spawnedID.toString())).append(":[").append(e.primaryColor).append(",").append(e.secondaryColor)
        .append(",").append(q(String.valueOf(EntityList.getTranslationName(e.spawnedID)))).append("]");
      first = false;
    }
    o.append("\n}\n}\n");
    try (Writer w = new OutputStreamWriter(new FileOutputStream(args[0]), StandardCharsets.UTF_8)) { w.write(o.toString()); }
    System.out.println("ok");
  }
}
