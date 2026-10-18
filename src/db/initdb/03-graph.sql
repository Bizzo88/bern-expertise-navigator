-- AGE graph "expertise_graph": labels created explicitly (bern_app has no DDL).
SET search_path = ag_catalog, "$user", public;

SELECT create_graph('expertise_graph');

-- Vertices: entity_id -> nav.entity.id ; Source.name -> nav.source.name ; Topic.key = normalized expertise
SELECT create_vlabel('expertise_graph', 'Person');
SELECT create_vlabel('expertise_graph', 'Unit');
SELECT create_vlabel('expertise_graph', 'Project');
SELECT create_vlabel('expertise_graph', 'Infrastructure');
SELECT create_vlabel('expertise_graph', 'Source');
SELECT create_vlabel('expertise_graph', 'Topic');

-- Typed edges
SELECT create_elabel('expertise_graph', 'MEMBER_OF');     -- person -> unit
SELECT create_elabel('expertise_graph', 'WORKS_ON');      -- person -> project
SELECT create_elabel('expertise_graph', 'PART_OF');       -- project -> unit, unit -> unit
SELECT create_elabel('expertise_graph', 'OPERATES');      -- unit -> infrastructure
SELECT create_elabel('expertise_graph', 'FROM_SOURCE');   -- entity -> source
SELECT create_elabel('expertise_graph', 'HAS_EXPERTISE'); -- person|unit|project -> topic

-- Indexes: GIN on properties (match {entity_id: ...}) and start/end on edges (traversal).
DO $$
DECLARE l text;
BEGIN
  FOREACH l IN ARRAY ARRAY['Person','Unit','Project','Infrastructure','Source','Topic'] LOOP
    EXECUTE format('CREATE INDEX %I ON expertise_graph.%I USING gin (properties)', lower(l) || '_props_gin', l);
  END LOOP;
  FOREACH l IN ARRAY ARRAY['MEMBER_OF','WORKS_ON','PART_OF','OPERATES','FROM_SOURCE','HAS_EXPERTISE'] LOOP
    EXECUTE format('CREATE INDEX %I ON expertise_graph.%I (start_id)', lower(l) || '_start_idx', l);
    EXECUTE format('CREATE INDEX %I ON expertise_graph.%I (end_id)',   lower(l) || '_end_idx',   l);
  END LOOP;
END $$;
