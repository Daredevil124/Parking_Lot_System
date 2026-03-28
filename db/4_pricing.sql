CREATE TABLE PricingRule (
    vehicle_type VARCHAR2(20) PRIMARY KEY,
    hourly_rate NUMBER(10, 2)
);

INSERT INTO PricingRule VALUES ('CAR', 10.00);
INSERT INTO PricingRule VALUES ('BIKE', 5.00);
INSERT INTO PricingRule VALUES ('TRUCK', 15.00);
COMMIT;

CREATE OR REPLACE FUNCTION FUNC_CALCULATE_FEE (
    p_ticket_id IN VARCHAR2
) RETURN NUMBER AS
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_vehicle_type VARCHAR2(20);
    v_hours NUMBER;
    v_rate NUMBER;
    v_fee NUMBER;
BEGIN
    v_end_time := CURRENT_TIMESTAMP;

    -- Look up the ticket and vehicle details
    SELECT t.start_time, v.vehicle_type
    INTO v_start_time, v_vehicle_type
    FROM TICKET t
    JOIN VEHICLE v ON t.vehicle_id = v.vehicle_id
    WHERE t.ticket_id = p_ticket_id AND t.status = 'ACTIVE';

    -- Calculate difference in hours
    SELECT
        EXTRACT(DAY FROM (v_end_time - v_start_time)) * 24 +
        EXTRACT(HOUR FROM (v_end_time - v_start_time)) +
        EXTRACT(MINUTE FROM (v_end_time - v_start_time)) / 60
    INTO v_hours
    FROM DUAL;

    -- Minimum charge of 1 hour
    IF v_hours < 1 THEN
        v_hours := 1;
    END IF;

    -- Fetch dynamic pricing rate from table
    BEGIN
        SELECT hourly_rate INTO v_rate FROM PricingRule WHERE vehicle_type = v_vehicle_type;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            v_rate := 10.00; -- Fallback rate
    END;

    v_fee := ROUND(v_hours * v_rate, 2);
    RETURN v_fee;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20004, 'Active ticket not found.');
END;
/
