import net.minecraft.init.Bootstrap;
import net.minecraft.init.Items;
import net.minecraft.creativetab.CreativeTabs;
import net.minecraft.enchantment.Enchantment;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.nbt.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

// Writes client/data/creative.json: the 1.8.9 creative tabs (CreativeTabs.displayAllReleventItems) and the search
// list (GuiContainerCreative.updateCreativeSearch), read from the game itself. Needs Java 11+ (single-file source
// launch), an MCP-named client jar and the server jar for its libraries:
//   java -cp mapped-client.jar:server.jar tools/creative-dump/Dump.java client/data/creative.json
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
      default: return "null";
    }
  }

  static String stack(ItemStack s) {
    String nbt = s.hasTagCompound() ? payload(s.getTagCompound()) : "null";
    return "[" + Item.getIdFromItem(s.getItem()) + "," + s.getMetadata() + "," + nbt + "]";
  }

  public static void main(String[] args) throws Exception {
    Bootstrap.register();
    StringBuilder o = new StringBuilder("{\n\"tabs\": [\n");
    boolean first = true;
    for (CreativeTabs t : CreativeTabs.creativeTabArray) {
      if (t == null) continue;
      List<ItemStack> list = new ArrayList<>();
      if (t == CreativeTabs.tabAllSearch) {
        for (Item it : Item.itemRegistry) if (it != null && it.getCreativeTab() != null) it.getSubItems(it, null, list);
        for (Enchantment e : Enchantment.enchantmentsBookList) if (e != null && e.type != null) Items.enchanted_book.getAll(e, list);
      } else if (t != CreativeTabs.tabInventory) t.displayAllReleventItems(list);
      o.append(first ? "" : ",\n").append("  {\"index\":").append(t.getTabIndex()).append(",\"label\":").append(q(t.getTabLabel()))
        .append(",\"icon\":").append(stack(t.getIconItemStack()))
        .append(",\"background\":").append(q(t.getBackgroundImageName())).append(",\"title\":").append(t.drawInForegroundOfTab())
        .append(",\"scrollbar\":").append(t.shouldHidePlayerInventory()).append(",\"column\":").append(t.getTabColumn()).append(",\"top\":").append(t.isTabInFirstRow())
        .append(",\"right\":false,\"items\":[");
      for (int i = 0; i < list.size(); i++) o.append(i > 0 ? "," : "").append(stack(list.get(i)));
      o.append("]}");
      first = false;
    }
    o.append("\n]\n}\n");
    try (Writer w = new OutputStreamWriter(new FileOutputStream(args[0]), StandardCharsets.UTF_8)) { w.write(o.toString()); }
    System.out.println("ok");
  }
}
