import type {
  PhotoGraphEdgeRow,
  PhotoGraphNeighborRow,
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
      photo_graph_neighbors: TableDefinition<
        PhotoGraphNeighborRow,
        PhotoGraphNeighborRow,
        Partial<PhotoGraphNeighborRow>
      >;
      photo_graph_settings: TableDefinition<
        PhotoGraphSettingRow,
        PhotoGraphSettingRow,
        Partial<PhotoGraphSettingRow>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      reserve_photo_graph_node_ids: {
        Args: { requested_count: number };
        Returns: number[];
      };
      replace_photo_graph_neighbor_snapshot: {
        Args: {
          source_ids: number[];
          neighbor_rows: unknown;
          generation_config: unknown;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
