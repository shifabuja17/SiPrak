import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';

import {
  detectBulkFileFormat,
  parseBulkCsvText,
  parseBulkXlsxContent,
} from './parser-core';
import {
  BulkParseError,
  type BulkParseResult,
  type ParseBulkFileOptions,
  type PickedBulkFile,
} from './types';

const BULK_PICKER_MIME_TYPES = [
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/**
 * Membuka picker dokumen sistem untuk memilih 1 file `.csv` atau `.xlsx`.
 * Mengembalikan `null` bila pengguna membatalkan pemilihan file.
 */
export async function pickBulkDocument(): Promise<PickedBulkFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: BULK_PICKER_MIME_TYPES,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return {
    name: asset.name,
    uri: asset.uri,
    mimeType: asset.mimeType,
    size: asset.size,
    file: asset.file,
    base64: asset.base64,
  };
}

async function readCsvTextFromAsset(asset: PickedBulkFile): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      if (asset.file) {
        return await asset.file.text();
      }
      const response = await fetch(asset.uri);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    }

    const file = new ExpoFile(asset.uri);
    return await file.text();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Gagal membaca file.';
    throw new BulkParseError(
      'READ_FAILED',
      `Tidak dapat membaca file CSV "${asset.name}": ${reason}`,
      { fileName: asset.name },
    );
  }
}

async function readXlsxBytesFromAsset(
  asset: PickedBulkFile,
): Promise<Uint8Array> {
  try {
    if (Platform.OS === 'web') {
      if (asset.file) {
        return new Uint8Array(await asset.file.arrayBuffer());
      }
      const response = await fetch(asset.uri);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    }

    const file = new ExpoFile(asset.uri);
    return await file.bytes();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Gagal membaca file.';
    throw new BulkParseError(
      'READ_FAILED',
      `Tidak dapat membaca file XLSX "${asset.name}": ${reason}`,
      { fileName: asset.name },
    );
  }
}

/**
 * Parser generik file `.csv` maupun `.xlsx` hasil unggahan `DocumentPicker` (atau `pickBulkDocument`):
 * 1. Memvalidasi ekstensi/format file sebelum membaca isi.
 * 2. Memvalidasi kolom header wajib.
 * 3. Menegakkan batas maksimal 500 baris data per unggahan (NFR-02).
 */
export async function parseBulkFile(
  asset: PickedBulkFile,
  options: ParseBulkFileOptions = {},
): Promise<BulkParseResult> {
  if (!asset || !asset.name || !asset.uri) {
    throw new BulkParseError(
      'READ_FAILED',
      'File unggahan tidak valid atau tidak memiliki URI.',
    );
  }

  const format = detectBulkFileFormat(asset.name, asset.mimeType);

  if (format === 'csv') {
    const csvText = await readCsvTextFromAsset(asset);
    return parseBulkCsvText(csvText, asset.name, options);
  }

  const xlsxBytes = await readXlsxBytesFromAsset(asset);
  return parseBulkXlsxContent(xlsxBytes, asset.name, options);
}
