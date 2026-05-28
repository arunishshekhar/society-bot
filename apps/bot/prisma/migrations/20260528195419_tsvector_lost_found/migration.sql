-- Add tsvector columns
ALTER TABLE "FoundItem" ADD COLUMN search_vector tsvector;
ALTER TABLE "LostItem"  ADD COLUMN search_vector tsvector;

-- GIN indexes for fast full-text search
CREATE INDEX found_item_search_idx ON "FoundItem" USING GIN(search_vector);
CREATE INDEX lost_item_search_idx  ON "LostItem"  USING GIN(search_vector);

-- Auto-update triggers
CREATE OR REPLACE FUNCTION update_found_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW."aiDescription", '') || ' ' || 
    COALESCE(NEW."originalDescription", '') || ' ' ||
    COALESCE(NEW."collectionLocation", '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER found_search_vector_trigger
BEFORE INSERT OR UPDATE ON "FoundItem"
FOR EACH ROW EXECUTE FUNCTION update_found_search_vector();

-- Same for LostItem
CREATE OR REPLACE FUNCTION update_lost_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW."aiDescription", '') || ' ' ||
    COALESCE(NEW."originalDescription", '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lost_search_vector_trigger
BEFORE INSERT OR UPDATE ON "LostItem"
FOR EACH ROW EXECUTE FUNCTION update_lost_search_vector();