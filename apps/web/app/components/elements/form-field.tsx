import {useId,type ReactNode} from 'react';import './form.css';
/** Render prop passes accessibility attributes to the project's native input/select/textarea. */
export default function FormField({label,hint,error,children}:{label:string;hint?:string;error?:string;children:(attributes:{id:string;'aria-invalid':boolean;'aria-describedby':string|undefined})=>ReactNode}){
 const id=useId(),description=[hint?id+'-hint':'',error?id+'-error':''].filter(Boolean).join(' ')||undefined;
 return <div className="form-field"><label htmlFor={id}>{label}</label>{children({id,'aria-invalid':!!error,'aria-describedby':description})}{hint&&<p id={id+'-hint'} className="field-hint">{hint}</p>}{error&&<p id={id+'-error'} className="field-error" role="alert">{error}</p>}</div>;
}
