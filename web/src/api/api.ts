import * as d3 from "d3";

import {
  CustomOptions,
  EmptyTokenizer,
  File as DolosFile,
  Fragment as DolosFragment,
  Index,
  Options,
  Region,
  TokenizedFile
} from "@dodona/dolos-lib";
import {
  adjectives,
  colors,
  names,
  uniqueNamesGenerator
} from "unique-names-generator";

const DATA_URL = "./data/";

// TODO: replace with actual assertion
function assertType<T>(item: T | undefined | null): T {
  if (item == null) {
    debugger;
    throw new Error("Unexpected undefined");
  }
  return item;
}
type Hash = number;
/**
 * Simple interface for plain javascript objects with numeric keys.
 */
export interface ObjMap<T> {
  [id: number]: T;
}

export interface Selection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

interface FileIndeterminate {
  id: number;
  path: string;
  content: string;
  astAndMappingLoaded: boolean;
  ast: string[] | string;
  mapping: Selection[] | string;
  amountOfKgrams: number;
  /* eslint-disable camelcase */
  extra: {
    timestamp?: Date;
    fullName?: string;
    labels?: string;
  };
  /* eslint-enable camelcase */
}

interface LoadedFile extends FileIndeterminate {
  astAndMappingLoaded: true;
  ast: string[];
  mapping: Selection[];
}

interface UnloadedFile extends FileIndeterminate {
  astAndMappingLoaded: false;
  ast: string;
  mapping: string;
}

export type File = LoadedFile | UnloadedFile;

export interface Kgram {
  id: number;
  hash: Hash;
  data: string;
  files: File[];
}

export interface PairedOccurrence {
  kgram: Kgram;
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

export interface Fragment {
  left: Selection;
  right: Selection;
  data: string[];
  occurrences: PairedOccurrence[];
  active: boolean;
}

export interface Pair {
  id: number;
  leftFile: File;
  rightFile: File;
  similarity: number;
  longestFragment: number;
  totalOverlap: number;
  fragments: Array<Fragment> | null;
  leftCovered: number;
  rightCovered: number;
}

export interface Metadata {
  [k: string]: unknown;
}

export interface ApiData {
  files: ObjMap<File>;
  pairs: ObjMap<Pair>;
  kgrams: ObjMap<Kgram>;
  metadata: Metadata;

}

async function fetchFiles(
  url = DATA_URL + "files.csv"
): Promise<d3.DSVRowArray> {
  return await d3.csv(url);
}

async function fetchPairs(
  url = DATA_URL + "pairs.csv"
): Promise<d3.DSVRowArray> {
  return await d3.csv(url);
}

async function fetchKgrams(
  url = DATA_URL + "kgrams.csv"
): Promise<d3.DSVRowArray> {
  return await d3.csv(url);
}

async function fetchMetadata(
  url = DATA_URL + "metadata.csv"
): Promise<d3.DSVRowArray> {
  return await d3.csv(url);
}

function parseFiles(fileData: d3.DSVRowArray, anonymize = false): ObjMap<File> {
  const randomNameGenerator = (): string => uniqueNamesGenerator({ dictionaries: [colors, names], length: 2 });
  const labelMap: Map<string, number> = new Map();
  const timeOffset = Math.random() * 1000 * 60 * 60 * 24 * 20;
  let labelCounter = 1;

  return Object.fromEntries(
    fileData.map(row => {
      const extra = JSON.parse(row.extra || "{}");
      extra.timestamp = extra.createdAt && new Date(extra.createdAt);
      row.extra = extra;

      if (anonymize) {
        const split = row.path!.split(".");
        const extension = split[split.length - 1];
        const name = randomNameGenerator();
        row.path = `${name}/exercise.${extension}`;
        extra.fullName = name;

        const label = labelMap.get(extra.labels) || labelCounter;
        if (!labelMap.has(extra.labels)) { labelCounter += 1; }
        labelMap.set(extra.labels, label);
        extra.labels = label;

        if (extra.timestamp) { extra.timestamp = new Date(extra.timestamp.getTime() + timeOffset); }
      }
      // row.mapping = JSON.parse(row.mapping || "[]");
      // row.ast = JSON.parse(row.ast || "[]");
      return [row.id, row];
    })
  );
}

function parseFragments(dolosFragments: DolosFragment[], kmersMap: Map<Hash, Kgram>): Fragment[] {
  // const parsed = JSON.parse(fragmentsJson);
  return dolosFragments.map((dolosFragment: DolosFragment): Fragment => {
    return {
      active: true,
      left: dolosFragment.leftSelection,
      right: dolosFragment.rightSelection,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      data: dolosFragment.mergedData!,
      occurrences: dolosFragment.pairs.map((occurrence): PairedOccurrence => {
        return {
          kgram: assertType(kmersMap.get(occurrence.fingerprint.hash)),
          left: occurrence.left,
          right: occurrence.right
        };
      })
    };
  });
}

function parsePairs(
  pairData: d3.DSVRowArray,
  files: ObjMap<File>,
  kgrams: ObjMap<Kgram>
): ObjMap<Pair> {
  return Object.fromEntries(
    pairData.map(row => {
      const id = parseInt(assertType(row.id));
      const similarity = parseFloat(assertType(row.similarity));
      const longestFragment = parseFloat(assertType(row.longestFragment));
      const totalOverlap = parseFloat(assertType(row.totalOverlap));
      const leftCovered = parseFloat(assertType((row.leftCovered)));
      const rightCovered = parseFloat(assertType((row.rightCovered)));

      const diff = {
        id,
        similarity,
        longestFragment,
        totalOverlap,
        leftFile: files[parseInt(assertType(row.leftFileId))],
        rightFile: files[parseInt(assertType(row.rightFileId))],
        fragments: null,
        leftCovered,
        rightCovered
      };
      return [id, diff];
    })
  );
}

function parseKgrams(kgramData: d3.DSVRowArray, fileMap: ObjMap<File>): ObjMap<Kgram> {
  return Object.fromEntries(kgramData.map(row => {
    const id = parseInt(assertType(row.id));
    const fileIds: number[] = assertType(JSON.parse(assertType(row.files)));
    const files: File[] = fileIds.map(id => fileMap[id]);
    const kgram = {
      id,
      hash: parseInt(assertType(row.hash)),
      data: assertType(row.data),
      files,
    };
    return [id, kgram];
  }));
}

type MetaRowType = { type: "string"; value: string } |
  { type: "boolean"; value: boolean } |
  { type: "number"; value: number} |
  { type: "object"; value: null }

function castToType(row: d3.DSVRowString): MetaRowType {
  const rowValue = row.value;
  const rowType = row.type;
  const newRow = row as MetaRowType;
  if (rowType === "boolean") {
    newRow.value = rowValue ? rowValue.toLowerCase() === "true" : false;
  } else if (rowValue && rowType === "number") {
    newRow.value = Number.parseFloat(rowValue);
  } else if (rowType === "object") {
    newRow.value = null;
  }
  return newRow;
}

function parseMetadata(data: d3.DSVRowArray): Metadata {
  return Object.fromEntries(
    data.map(row => [row.property, castToType(row).value])
  );
}

function fileToTokenizedFile(file: File): TokenizedFile {
  const dolosFile = new DolosFile(file.path, file.content);
  if (file.astAndMappingLoaded) {
    return new TokenizedFile(dolosFile, file.ast, file.mapping as Region[]);
  } else {
    throw new Error("File AST and mapping not parsed");
  }
}

export async function loadFragments(pair: Pair, kmers: ObjMap<Kgram>, customOptions: CustomOptions): Promise<void> {
  const emptyTokenizer = new EmptyTokenizer();
  const options = new Options(customOptions);
  const index = new Index(emptyTokenizer, options);
  const report = await index.compareTokenizedFiles(
    [fileToTokenizedFile(pair.leftFile), fileToTokenizedFile(pair.rightFile)]
  );
  const reportPair = report.scoredPairs[0].pair;
  const kmersMap: Map<Hash, Kgram> = new Map();
  for (const kmerKey in kmers) {
    const kmer = kmers[kmerKey];
    kmersMap.set(kmer.hash, kmer);
  }
  pair.fragments = parseFragments(reportPair.fragments(), kmersMap);
}

export async function fetchData(anonymize = false): Promise<ApiData> {
  const kgramPromise = fetchKgrams();
  const filePromise = fetchFiles();
  const metadataPromise = fetchMetadata();
  const pairPromise = fetchPairs();

  const files = parseFiles(await filePromise, anonymize);
  const kgrams = parseKgrams(await kgramPromise, files);
  const pairs = parsePairs(await pairPromise, files, kgrams);
  const metadata = parseMetadata(await metadataPromise);

  return { files, kgrams, pairs, metadata };
}
