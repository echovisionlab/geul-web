import { BlockingAlertDialog } from './BlockingAlertDialog';
import { DialogActions, type DialogActionsProps } from './DialogActions';
import { ConfirmModal } from './ConfirmModal';
import { OverlayDialog, type OverlayDialogProps } from './OverlayDialog';

const dialog = { opened: true, onClose: () => {}, title: 'Details', children: 'Content' };
<OverlayDialog {...dialog} size="wide" bodyLayout="fit" dismissible busy />;
<OverlayDialog {...dialog} role="alertdialog" descriptionId="message" />;
// @ts-expect-error Alert dialogs require an explicit message relationship.
<OverlayDialog {...dialog} role="alertdialog" />;
// @ts-expect-error Arbitrary roles cannot replace modal semantics.
<OverlayDialog {...dialog} role="region" />;
// @ts-expect-error Visual escapes are rejected through typed spreads.
const styled: OverlayDialogProps = { ...dialog, style: { width: 400 } };
// @ts-expect-error Modal dimensions are named Core presets.
<OverlayDialog {...dialog} size="420px" />;
<BlockingAlertDialog
  opened
  onAction={() => {}}
  title="Attention"
  message="Read this."
  actionLabel="Continue"
  loading
  level="warning"
/>;
// @ts-expect-error Blocking action labels are required.
<BlockingAlertDialog opened onAction={() => {}} title="Attention" message="Read this." />;
const confirm = {
  opened: true,
  onClose: () => {},
  onConfirm: () => {},
  title: 'Delete item',
  message: 'Remove?',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  closeLabel: 'Close',
};
<ConfirmModal {...confirm} confirmTone="danger" loading confirmDisabled />;
void styled;
<DialogActions leadingActions="Delete">Cancel and save</DialogActions>;
// @ts-expect-error Dialog actions always align concluding commands to the end.
<DialogActions justify="start">Save</DialogActions>;
// @ts-expect-error Actions retain their content widths.
<DialogActions grow>Save</DialogActions>;
// @ts-expect-error Arbitrary action gaps are not a public modal contract.
<DialogActions gap="xl">Save</DialogActions>;
// @ts-expect-error Presentation overrides are rejected through spreads too.
const styledActions: DialogActionsProps = { children: 'Save', style: { justifyContent: 'start' } };
void styledActions;
