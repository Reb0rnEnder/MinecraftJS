// Native 26.3 Dialog codec (server/dialog). Dialog.STREAM_CODEC carries a Holder<Dialog>:
// registry id + 1, or an inline dialog graph encoded as one unnamed NBT tag. The graph is
// flattened by the records' MapCodecs, so common fields, button fields and body fields all sit
// on the same compounds. Keep this module free of GUI imports; the screen consumes its output.
import {componentFromNbt} from './component-nbt-1.20.6.js';

const shortName = value => String(value || '').replace(/^minecraft:/, '');
const child = (node, key) => node && node.t === 10 ? node.v[key] : undefined;
const stringValue = node => node && node.t === 8 ? String(node.v) : null;
const intValue = node => node && (node.t === 3 || node.t === 2) ? Number(node.v) : null;
const boolValue = (node, fallback) => node && node.t === 1 ? node.v !== 0 : fallback;
const listValue = node => node && node.t === 9 ? node.items : null;

function componentValue(node) {
  return node ? componentFromNbt(node) : null;
}

function resolveDialogHolder(node, registry) {
  if (!node) return null;
  if (node.t === 10) {
    // RegistryCodecs.holder accepts a direct value object or an {id: ...} holder.
    const id = stringValue(child(node, 'id'));
    if (id && !child(node, 'type')) return registry?.byKey?.get(id) || null;
    return parseDialog263(node, registry);
  }
  const id = stringValue(node);
  if (id) {
    const raw = registry?.byKey?.get(id);
    return raw ? parseDialog263(raw, registry) : null;
  }
  const numeric = intValue(node);
  if (numeric !== null) {
    const raw = registry?.byId?.get(numeric);
    return raw ? parseDialog263(raw, registry) : null;
  }
  return null;
}

function actionFromTag(tag, registry) {
  if (!tag || tag.t !== 10) return null;
  const type = shortName(stringValue(child(tag, 'type')));
  const data = tag.v;
  switch (type) {
    case 'open_url': {
      const url = stringValue(data.url);
      return url ? {type: 'open_url', url} : null;
    }
    case 'run_command': {
      const command = stringValue(data.command);
      return command ? {type: 'run_command', command} : null;
    }
    case 'suggest_command': {
      const command = stringValue(data.command);
      return command ? {type: 'suggest_command', command} : null;
    }
    case 'copy_to_clipboard': {
      const value = stringValue(data.value);
      return value == null ? null : {type: 'copy_to_clipboard', value};
    }
    case 'show_dialog': {
      const dialog = resolveDialogHolder(data.dialog, registry);
      return dialog ? {type: 'open_dialog', dialog} : null;
    }
    case 'custom': {
      const id = stringValue(data.id);
      return id ? {type: 'custom', id, payload: data.additions || null} : null;
    }
    case 'dynamic/run_command': {
      const template = stringValue(data.template);
      // Templates are filled from dialog inputs. With no input widget model yet, only a template
      // that needs no substitution is safe to run.
      return template != null && !/\$\{/.test(template) ? {type: 'run_command', command: template} : null;
    }
    case 'dynamic/custom': {
      const id = stringValue(data.id);
      return id ? {type: 'custom', id, payload: data.additions || null} : null;
    }
    default:
      return null;
  }
}

function buttonFromTag(tag, registry, fallbackLabel = null) {
  if (!tag) return null;
  // CommonButtonData is inlined in ActionButton.CODEC, so label/width/action sit on the same
  // compound. Keep accepting a nested "button" compound in case a server writes that form.
  const nested = child(tag, 'button');
  const data = nested && nested.t === 10 ? nested : tag;
  const labelTag = child(data, 'label');
  const tooltipTag = child(data, 'tooltip');
  const actionTag = child(tag, 'action') || child(data, 'action');
  const width = intValue(child(data, 'width'));
  const label = labelTag ? componentValue(labelTag) : fallbackLabel;
  return {
    label,
    tooltip: tooltipTag ? componentValue(tooltipTag) : null,
    width: Math.max(1, Math.min(1024, width == null ? 150 : width)),
    action: actionFromTag(actionTag, registry)
  };
}

function bodyFromTag(tag) {
  if (!tag) return null;
  const type = tag.t === 10 ? shortName(stringValue(child(tag, 'type'))) : null;
  if (type === 'item') {
    const item = child(tag, 'item');
    const itemId = shortName(stringValue(item) || stringValue(child(item, 'id')) || '');
    const description = child(tag, 'description');
    return {
      type: 'item',
      itemId,
      description: description ? componentValue(description) : null,
      width: intValue(child(tag, 'width')) ?? 16,
      height: intValue(child(tag, 'height')) ?? 16
    };
  }
  if (type === 'plain_message') {
    return {
      type: 'plain_message',
      component: componentValue(child(tag, 'contents')),
      width: intValue(child(tag, 'width')) ?? 200
    };
  }
  // DialogBody.COMPACT_LIST_CODEC accepts a bare component as a plain message.
  return {type: 'plain_message', component: componentValue(tag), width: 200};
}

function parseBodies(tag) {
  if (!tag) return [];
  const items = listValue(tag);
  return (items || [tag]).map(bodyFromTag).filter(Boolean);
}

function holderSet(node, registry) {
  const items = listValue(node) || (node ? [node] : []);
  return items.map(item => resolveDialogHolder(item, registry)).filter(Boolean);
}

// Parse Dialog.DIRECT_CODEC's NBT form.
export function parseDialog263(tag, registry = null) {
  if (!tag || tag.t !== 10) throw Error('Dialog must be an NBT compound');
  const type = shortName(stringValue(child(tag, 'type')));
  const title = componentValue(child(tag, 'title'));
  if (title == null) throw Error('Dialog has no title');
  const common = {
    title,
    externalTitle: componentValue(child(tag, 'external_title')),
    canCloseWithEscape: boolValue(child(tag, 'can_close_with_escape'), true),
    pause: boolValue(child(tag, 'pause'), true),
    afterAction: shortName(stringValue(child(tag, 'after_action')) || 'close'),
    bodies: parseBodies(child(tag, 'body')),
    inputs: (listValue(child(tag, 'inputs')) || []).length
  };
  const dialog = {...common, type, inputCount: common.inputs, onCancel: null, buttons: [], exitAction: null, columns: 2};
  switch (type) {
    case 'notice':
      dialog.buttons = [buttonFromTag(child(tag, 'action'), registry, {translate: 'gui.ok'})].filter(Boolean);
      // NoticeDialog.onCancel is its one action.
      dialog.onCancel = dialog.buttons[0]?.action || null;
      break;
    case 'confirmation':
      dialog.buttons = [
        buttonFromTag(child(tag, 'yes'), registry, {translate: 'gui.yes'}),
        buttonFromTag(child(tag, 'no'), registry, {translate: 'gui.no'})
      ].filter(Boolean);
      // ConfirmationDialog.onCancel is the no button's action.
      dialog.onCancel = dialog.buttons[1]?.action || null;
      break;
    case 'multi_action':
      dialog.buttons = (listValue(child(tag, 'actions')) || []).map(action => buttonFromTag(action, registry)).filter(Boolean);
      dialog.columns = intValue(child(tag, 'columns')) ?? 2;
      dialog.exitAction = buttonFromTag(child(tag, 'exit_action'), registry);
      dialog.onCancel = dialog.exitAction?.action || null;
      break;
    case 'dialog_list':
      dialog.buttons = holderSet(child(tag, 'dialogs'), registry).map(entry => ({
        label: entry.externalTitle || entry.title,
        tooltip: null,
        width: intValue(child(tag, 'button_width')) ?? 150,
        action: {type: 'open_dialog', dialog: entry}
      }));
      dialog.columns = intValue(child(tag, 'columns')) ?? 2;
      dialog.exitAction = buttonFromTag(child(tag, 'exit_action'), registry);
      dialog.onCancel = dialog.exitAction?.action || null;
      break;
    case 'server_links':
      // Server link entries arrive in ClientboundServerLinksPacket; the dialog only supplies
      // their button layout. Until the game stores that packet, show the dialog without links.
      dialog.columns = intValue(child(tag, 'columns')) ?? 2;
      dialog.buttonWidth = intValue(child(tag, 'button_width')) ?? 150;
      dialog.exitAction = buttonFromTag(child(tag, 'exit_action'), registry);
      dialog.onCancel = dialog.exitAction?.action || null;
      break;
    default:
      throw Error('Unsupported 26.3 dialog type ' + (type || '(missing)'));
  }
  if (!Number.isInteger(dialog.columns) || dialog.columns < 1) dialog.columns = 1;
  return dialog;
}

export function parseDialogRegistry263(configuration) {
  const entries = configuration?.registries?.get?.('minecraft:dialog') || [];
  const byId = new Map(), byKey = new Map();
  for (const entry of entries) {
    if (entry.value) {
      byId.set(entry.id, entry.value);
      byKey.set(entry.key, entry.value);
    }
  }
  return {byId, byKey};
}
