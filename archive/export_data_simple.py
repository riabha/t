"""
Simple data export - exports all data as-is without field mapping
"""
import json
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from database import SessionLocal
from models import *

def export_data():
    db = SessionLocal()
    
    try:
        data = {}
        
        # Get all model classes
        models_to_export = [
            ('users', User),
            ('departments', Department),
            ('batches', Batch),
            ('teachers', Teacher),
            ('subjects', Subject),
            ('rooms', Room),
            ('sections', Section),
            ('assignments', Assignment),
            ('teacher_restrictions', TeacherRestriction),
            ('timetables', Timetable),
            ('timetable_slots', TimetableSlot),
            ('schedule_configs', ScheduleConfig),
            ('global_configs', GlobalConfig),
            ('assignment_sessions', AssignmentSession)
        ]
        
        for table_name, model_class in models_to_export:
            print(f"Exporting {table_name}...")
            data[table_name] = []
            
            for obj in db.query(model_class).all():
                # Get all columns
                mapper = inspect(obj)
                item = {}
                for column in mapper.mapper.column_attrs:
                    value = getattr(obj, column.key)
                    # Convert datetime to string
                    if hasattr(value, 'isoformat'):
                        value = value.isoformat()
                    item[column.key] = value
                data[table_name].append(item)
            
            print(f"✅ Exported {len(data[table_name])} {table_name}")
        
        # Save to JSON
        with open('data_export.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print("\n🎉 Export completed successfully!")
        print(f"📁 File saved as: data_export.json")
        
    except Exception as e:
        print(f"❌ Error during export: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    export_data()
