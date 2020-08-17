import * as d3 from "d3";
// import { assertType } from "typescript-is";

// TODO: replace with actual assertion
function assertType<T>(item: T | undefined | null): T {
  if (item == null) {
    debugger;
    throw new Error("Unexpected undefined");
  }
  return item;
}

/**
 * Simple interface for plain javascript objects with numeric keys.
 */
export interface ObjMap<T> {
  [id: number]: T;
}

export interface File {
  id: number;
  path: string;
  content: string;
  ast: string;
}

export interface Selection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface PairedOccurrence {
  kmer: Kmer;
  left: {
    start: number;
    stop: number;
    index: number;
  };
  right: {
    start: number;
    stop: number;
    index: number;
  };
}

export interface Block {
  left: Selection;
  right: Selection;
  data: string;
  pairs: PairedOccurrence[];
}

export interface Diff {
  id: number;
  leftFile: File;
  rightFile: File;
  similarity: number;
  continuousOverlap: number;
  totalOverlap: number;
}

export interface Kmer {
  id: number;
  hash: number;
  data: string;
  files: File[];
}

export interface Metadata {
  [k: string]: unknown;
}

export interface ApiData {
  files: ObjMap<File>;
  diffs: ObjMap<Diff>;
  kmers: ObjMap<Kmer>;
  metadata: Metadata;
}

async function fetchFiles(
  url = "/data/files.csv"
): Promise<d3.DSVRowArray> {
  return await d3.csv(url);
}

async function fetchDiffs(
  url = "/data/diffs.csv"
): Promise<d3.DSVRowArray> {
  return await d3.csv(url);
}

async function fetchKmers(
  url = "/data/kmers.csv"
): Promise<d3.DSVRowArray> {
  return await d3.csv(url);
}

async function fetchMetadata(
  url = "/data/metadata.csv"
): Promise<d3.DSVRowArray> {
  return await d3.csv(url);
}

async function _fetchBlocks(
  diffId: number,
  url = "/data/blocks/"
): Promise<string> {
  return await d3.text(url + diffId + ".json");
}

function parseFiles(fileData: d3.DSVRowArray): ObjMap<File> {
  return Object.fromEntries(fileData.map(row => [row.id, row]));
}

function parseBlocks(blocksJson: string, kmers: ObjMap<Kmer>): Block[] {
  const parsed = JSON.parse(blocksJson);
  return parsed.map((blockData: any): Block => {
    return {
      left: blockData.leftSelection,
      right: blockData.rightSelection,
      data: blockData.data,
      pairs: blockData.pairedOccurrences.map((pair: any): PairedOccurrence => {
        return {
          kmer: kmers[pair.sharedKmer],
          left: pair.left,
          right: pair.right
        };
      })
    };
  });
}

function parseDiffs(
  diffData: d3.DSVRowArray,
  files: ObjMap<File>,
  kmers: ObjMap<Kmer>,
): ObjMap<Diff> {
  return Object.fromEntries(
    diffData.map(row => {
      const id = parseInt(assertType(row.id));
      const similarity = parseFloat(assertType(row.similarity));
      const continuousOverlap = parseFloat(assertType(row.continuousOverlap));
      const totalOverlap = parseFloat(assertType(row.totalOverlap));

      const diff = {
        id,
        similarity,
        continuousOverlap,
        totalOverlap,
        // blocks: blocks,
        leftFile: files[parseInt(assertType(row.leftFileId))],
        rightFile: files[parseInt(assertType(row.rightFileId))],
      };
      return [id, diff];
    })
  );
}

function parseKmers(kmerData: d3.DSVRowArray, fileMap: ObjMap<File>): ObjMap<Kmer> {
  return Object.fromEntries(kmerData.map(row => {
    const id = parseInt(assertType(row.id));
    const fileIds: number[] = assertType(JSON.parse(assertType(row.files)));
    const files: File[] = fileIds.map(id => fileMap[id]);
    const kmer = {
      id,
      hash: parseInt(assertType(row.hash)),
      data: assertType(row.data),
      files,
    };
    return [id, kmer];
  }));
}

function parseMetadata(data: d3.DSVRowArray): Metadata {
  return Object.fromEntries(
    data.map(row => [row.property, row.value])
  );
}

export async function fetchBlocks(diffId: number, kmers: ObjMap<Kmer>): Promise<Array<Block>> {
  const blocksPromise = _fetchBlocks(diffId);
  return parseBlocks(await blocksPromise, kmers);
}

export async function fetchData(): Promise<ApiData> {
  const kmerPromise = fetchKmers();
  const filePromise = fetchFiles();
  const metadataPromise = fetchMetadata();
  const diffPromise = fetchDiffs();

  const files = parseFiles(await filePromise);
  const kmers = parseKmers(await kmerPromise, files);
  const diffs = parseDiffs(await diffPromise, files, kmers);
  const metadata = parseMetadata(await metadataPromise);

  return { files, kmers, diffs: diffs, metadata };
}
