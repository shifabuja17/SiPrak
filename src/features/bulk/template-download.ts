import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import {
  ASPRAK_TEMPLATE_DEFINITION,
  buildTemplateCsv,
  buildTemplateXlsxBase64,
  buildTemplateXlsxBytes,
  LAB_TEMPLATE_DEFINITION,
  PRAKTIKAN_TEMPLATE_DEFINITION,
} from './templates';
import type { BulkFileFormat, BulkTemplateDefinition } from './types';

const TEMPLATE_MIME_TYPES: Record<BulkFileFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const TEMPLATE_IOS_UTI: Record<BulkFileFormat, string> = {
  csv: 'public.comma-separated-values-text',
  xlsx: 'org.openxmlformats.spreadsheetml.sheet',
};

export interface TemplateDownloadResult {
  fileName: string;
  format: BulkFileFormat;
  uri?: string;
}

function triggerWebDownload(
  fileName: string,
  mimeType: string,
  payload: BlobPart,
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Browser tidak mendukung pengunduhan file langsung.');
  }

  const blob = new Blob([payload], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  }
}

async function downloadTemplateFile(
  definition: BulkTemplateDefinition,
  format: BulkFileFormat = 'xlsx',
): Promise<TemplateDownloadResult> {
  const fileName = `${definition.fileBaseName}.${format}`;
  const mimeType = TEMPLATE_MIME_TYPES[format];

  if (Platform.OS === 'web') {
    if (format === 'csv') {
      triggerWebDownload(fileName, `${mimeType};charset=utf-8`, buildTemplateCsv(definition));
    } else {
      const bytes = buildTemplateXlsxBytes(definition);
      const bufferCopy = new Uint8Array(bytes.byteLength);
      bufferCopy.set(bytes);
      triggerWebDownload(fileName, mimeType, bufferCopy.buffer);
    }
    return { fileName, format };
  }

  const targetFile = new ExpoFile(Paths.cache, fileName);
  targetFile.create({ overwrite: true });

  if (format === 'csv') {
    await targetFile.write(buildTemplateCsv(definition), { encoding: 'utf8' });
  } else {
    await targetFile.write(buildTemplateXlsxBase64(definition), {
      encoding: 'base64',
    });
  }

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error(
      'Fitur berbagi/simpan file tidak tersedia di perangkat ini.',
    );
  }

  await Sharing.shareAsync(targetFile.uri, {
    dialogTitle: definition.title,
    mimeType,
    UTI: TEMPLATE_IOS_UTI[format],
  });

  return {
    fileName,
    format,
    uri: targetFile.uri,
  };
}

/**
 * Mengunduh / membagikan file template khusus import Laboratorium (FR-04).
 */
export function downloadLabTemplate(
  format: BulkFileFormat = 'xlsx',
): Promise<TemplateDownloadResult> {
  return downloadTemplateFile(LAB_TEMPLATE_DEFINITION, format);
}

/**
 * Mengunduh / membagikan file template khusus import Praktikan (FR-04).
 */
export function downloadPraktikanTemplate(
  format: BulkFileFormat = 'xlsx',
): Promise<TemplateDownloadResult> {
  return downloadTemplateFile(PRAKTIKAN_TEMPLATE_DEFINITION, format);
}

/**
 * Mengunduh / membagikan file template khusus import Asprak (FR-04).
 */
export function downloadAsprakTemplate(
  format: BulkFileFormat = 'xlsx',
): Promise<TemplateDownloadResult> {
  return downloadTemplateFile(ASPRAK_TEMPLATE_DEFINITION, format);
}
