export enum TokenType {
  Scalar = "SCALAR",
  QuotedScalar = "QUOTED_SCALAR",
  MappingValue = "MAPPING_VALUE",
  SequenceEntry = "SEQUENCE_ENTRY",
  FlowSequenceStart = "FLOW_SEQ_START",
  FlowSequenceEnd = "FLOW_SEQ_END",
  FlowMappingStart = "FLOW_MAP_START",
  FlowMappingEnd = "FLOW_MAP_END",
  FlowEntry = "FLOW_ENTRY",
  DocumentStart = "DOC_START",
  DocumentEnd = "DOC_END",
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  indent: number;
  line: number;
  column: number;
}
