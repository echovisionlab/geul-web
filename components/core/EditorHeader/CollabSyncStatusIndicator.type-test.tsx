import { CollabSyncStatusIndicator } from './CollabSyncStatusIndicator';

const standard = <CollabSyncStatusIndicator isConnected isSynced label="Synced" />;
// @ts-expect-error Core owns indicator geometry; consumers cannot supply arbitrary dimensions.
const resized = <CollabSyncStatusIndicator isConnected isSynced label="Synced" size={20} />;
// @ts-expect-error Consumers cannot override the indicator's presentation.
const styled = <CollabSyncStatusIndicator isConnected isSynced label="Synced" style={{ marginTop: 3 }} />;
void [standard, resized, styled];

const durable = <CollabSyncStatusIndicator state="error" label="Save failed · retrying" />;
// @ts-expect-error Durable and transport inputs must not conflict.
const contradictory = <CollabSyncStatusIndicator state="saved" isConnected={false} isSynced={false} label="Saved" />;
// @ts-expect-error State is a closed semantic contract.
const unknown = <CollabSyncStatusIndicator state="connected" label="Connected" />;
void [durable, contradictory, unknown];
