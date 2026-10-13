import { CollabSyncStatusIndicator } from './CollabSyncStatusIndicator';

const standard = <CollabSyncStatusIndicator isConnected isSynced label="Synced" />;
// @ts-expect-error Core owns indicator geometry; consumers cannot supply arbitrary dimensions.
const resized = <CollabSyncStatusIndicator isConnected isSynced label="Synced" size={20} />;
// @ts-expect-error Consumers cannot override the indicator's presentation.
const styled = <CollabSyncStatusIndicator isConnected isSynced label="Synced" style={{ marginTop: 3 }} />;
void [standard, resized, styled];
