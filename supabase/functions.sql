-- Agregar esta función al SQL Editor de Supabase también
create or replace function increment_counter(counter_key text)
returns integer as $$
declare
  new_val integer;
begin
  update counters set value = value + 1 where key = counter_key
  returning value into new_val;
  if not found then
    insert into counters (key, value) values (counter_key, 1) returning value into new_val;
  end if;
  return new_val;
end;
$$ language plpgsql;
