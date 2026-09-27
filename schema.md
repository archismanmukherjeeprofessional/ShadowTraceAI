## Table `entities`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `entity_id` | `uuid` | Primary |
| `entity_type` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `observations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `observation_id` | `uuid` | Primary |
| `entity_id` | `uuid` |  Nullable |
| `source_entity_id` | `uuid` |  Nullable |
| `source_id` | `text` |  |
| `raw_reference` | `text` |  Nullable |
| `observation_data` | `jsonb` |  |
| `normalized_data` | `jsonb` |  Nullable |
| `observation_confidence` | `numeric` |  Nullable |
| `observed_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `rules`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `rule_id` | `text` | Primary |
| `rule_version` | `text` | Primary |
| `evidence_type` | `text` |  |
| `enabled` | `bool` |  |
| `rule_definition` | `jsonb` |  |
| `created_at` | `timestamptz` |  |

## Table `independence_groups`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `independence_group_id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |

## Table `hard_evidence`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `evidence_id` | `uuid` | Primary |
| `source_entity_id` | `uuid` |  |
| `target_entity_id` | `uuid` |  |
| `evidence_type` | `text` |  |
| `rule_id` | `text` |  |
| `rule_version` | `text` |  |
| `effective_weight` | `numeric` |  |
| `confidence` | `numeric` |  |
| `independence_group_id` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `hard_evidence_observations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `evidence_id` | `uuid` | Primary |
| `observation_id` | `uuid` | Primary |

## Table `relationship_edges`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `edge_id` | `uuid` | Primary |
| `source_entity_id` | `uuid` |  |
| `target_entity_id` | `uuid` |  |
| `relationship_type` | `text` |  |
| `evidence_id` | `uuid` |  Nullable |
| `confidence` | `numeric` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `ai_signals`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `ai_signal_id` | `uuid` | Primary |
| `source_entity_id` | `uuid` |  |
| `target_entity_id` | `uuid` |  |
| `signal_type` | `text` |  |
| `raw_value` | `numeric` |  |
| `value` | `numeric` |  |
| `calibration_applied` | `bool` |  |
| `model_id` | `text` |  |
| `model_version` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `calibration_curves`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `calibration_id` | `uuid` | Primary |
| `signal_type` | `text` |  |
| `model_id` | `text` |  |
| `model_version` | `text` |  |
| `calibration_data` | `jsonb` |  |
| `created_at` | `timestamptz` |  |

## Table `calibration_samples`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `sample_id` | `uuid` | Primary |
| `source_entity_id` | `uuid` |  Nullable |
| `target_entity_id` | `uuid` |  Nullable |
| `raw_value` | `numeric` |  Nullable |
| `label` | `bool` |  Nullable |
| `adjudicated` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `fusion_configs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `config_version` | `text` | Primary |
| `weights` | `jsonb` |  |
| `caps` | `jsonb` |  |
| `alpha` | `numeric` |  |
| `ai_max_contribution` | `numeric` |  |
| `dependence_discount_fn` | `jsonb` |  |
| `score_bands` | `jsonb` |  |
| `effective_from` | `timestamptz` |  |
| `effective_until` | `timestamptz` |  Nullable |

## Table `fused_scores`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `score_id` | `uuid` | Primary |
| `pair_id` | `text` |  |
| `confidence` | `numeric` |  |
| `classification` | `text` |  |
| `contributing_evidence` | `jsonb` |  |
| `caps_applied` | `jsonb` |  |
| `independence_notes` | `jsonb` |  |
| `fusion_config_version` | `text` |  |
| `created_at` |