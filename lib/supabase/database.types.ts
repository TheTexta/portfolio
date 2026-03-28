import type {
  PhotoGraphEdgeRow,
  PhotoGraphNodeRow,
  PhotoGraphSettingRow,
} from "@/lib/photo-graph/types";

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type SupabaseDatabase = {
  public: {
    Tables: {
      photo_graph_nodes: TableDefinition<
        PhotoGraphNodeRow,
        Omit<PhotoGraphNodeRow, "created_at">,
        Partial<Omit<PhotoGraphNodeRow, "created_at">>
      >;
      photo_graph_edges: TableDefinition<
        PhotoGraphEdgeRow,
        Omit<PhotoGraphEdgeRow, "created_at">,
        Partial<Omit<PhotoGraphEdgeRow, "created_at">>
      >;
      photo_graph_settings: TableDefinition<
        PhotoGraphSettingRow,
        PhotoGraphSettingRow,
        Partial<PhotoGraphSettingRow>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
